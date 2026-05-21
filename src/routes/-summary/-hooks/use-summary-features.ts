import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { GeoJsonProperties } from 'geojson'
import { queryKeys } from '@/lib/query-keys'
import type { ExtendedFeature, LayerContentProps } from '@/components/maps/popups/types'
import type { LayerProps, WFSLayerProps, WMSLayerProps } from '@/lib/types/mapping-types'
import { findLayerByTitle, parseWmsUrl } from '@/lib/map/layer-utils'
import { fetchFeaturesByOgcFids } from '@/lib/map/wfs-service'
import { fetchFeaturesByOgcFidsFromParquet } from '@/lib/query-parquet'
import { useAllPagesLayerConfigs } from '@/hooks/use-get-layer-configs'
import { decodeSelection, type SelectionRef } from '../-utils/selection-url'

const STORAGE_KEY = 'summary:popup-content'

export interface UseSummaryFeaturesResult {
    cards: LayerContentProps[]
    refs: SelectionRef[]
    isLoading: boolean
    isError: boolean
    /** True when paint came from the sessionStorage stash (instant) — eventually replaced by the WFS revalidation. */
    fromStash: boolean
}

/**
 * Hydrate a feature selection for the summary route. URL `?features=...` is
 * the source of truth; the popup's "Expand" stash provides a `placeholderData`
 * so the page paints instantly while WFS revalidates in the background.
 *
 * For URLs opened in a fresh tab (no stash), the global layer-config registry
 * lets the page still render fields, related tables, and image fields without
 * a manual lookup per route.
 */
function readStash(): LayerContentProps[] | undefined {
    if (typeof window === 'undefined') return undefined
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return undefined
        const parsed = JSON.parse(raw) as LayerContentProps[]
        return Array.isArray(parsed) ? parsed : undefined
    } catch {
        return undefined
    }
}

const EMPTY_CARDS: LayerContentProps[] = []

export function useSummaryFeatures(rawFeatures: string): UseSummaryFeaturesResult {
    const refs = useMemo(() => decodeSelection(rawFeatures), [rawFeatures])
    // Stash is keyed to the previously-expanded popup, not to a URL. Only
    // use it when the URL actually carries refs — an empty `?features=` page
    // should render empty, not hydrate from stale session state.
    const stashedContent = useMemo(
        () => (refs.length > 0 ? readStash() : undefined),
        [rawFeatures, refs.length],
    )
    const { data: allLayers = [], isLoading: configsLoading } = useAllPagesLayerConfigs()

    const query = useQuery({
        queryKey: queryKeys.summary.byRefs(refs),
        queryFn: () => buildLayerContent(refs, allLayers, stashedContent ?? []),
        enabled: refs.length > 0 && allLayers.length > 0,
        placeholderData: stashedContent,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    })

    // No refs in the URL → no summary, no spinner. Skip the query state entirely.
    if (refs.length === 0) {
        return { cards: EMPTY_CARDS, refs, isLoading: false, isError: false, fromStash: false }
    }

    const cards = query.data ?? EMPTY_CARDS
    const fromStash = query.isPlaceholderData
    const isLoading = configsLoading || query.isLoading || query.isFetching

    return { cards, refs, isLoading, isError: query.isError, fromStash }
}

/**
 * Build LayerContentProps for each selected layer. Resolution order per layer:
 *
 *   1. **Refetch via parquet** (preferred) or WFS (fallback) when the layer
 *      has a by-id source AND the fetch returns features. Authoritative.
 *   2. **Stash carry-over** when refetch returns empty (non-numeric IDs,
 *      raster-only layer, offline endpoint). Preserves the rich data the
 *      popup already had so features don't blink out from under the user.
 *   3. **Drop** when neither path yields anything.
 *
 * Always merges with the stash by layer title — a layer present only in the
 * stash (no entries in `refs`) is dropped, but a layer in both with an empty
 * refetch keeps its stashed cards.
 */
async function buildLayerContent(
    refs: SelectionRef[],
    allLayers: LayerProps[],
    stashedCards: LayerContentProps[],
): Promise<LayerContentProps[]> {
    const byLayer = new Map<string, string[]>()
    for (const ref of refs) {
        const list = byLayer.get(ref.layerTitle) ?? []
        list.push(ref.featureId)
        byLayer.set(ref.layerTitle, list)
    }

    const stashByLayer = new Map<string, LayerContentProps>(
        stashedCards.map(c => [c.layerTitle, c]),
    )

    const results: LayerContentProps[] = []

    for (const [layerTitle, ids] of byLayer) {
        const stashed = stashByLayer.get(layerTitle)
        const layer = findLayerByTitle(allLayers, layerTitle)

        if (!layer) {
            // Layer not in the cross-route registry (e.g. ad-hoc title).
            // Use the stash if we have it; otherwise skip.
            if (stashed) results.push(stashed)
            else console.warn(`summary: layer "${layerTitle}" not found in cross-route config registry`)
            continue
        }

        const source = resolveFeatureSource(layer)
        if (!source) {
            // Raster-only layer or layer with no by-id endpoint — stash is
            // the only data source.
            if (stashed) results.push(stashed)
            continue
        }

        const features = source.kind === 'parquet'
            ? await fetchFeaturesByOgcFidsFromParquet(source.parquetUrl, ids)
            : await fetchFeaturesByOgcFids(source.wfsUrl, source.typeName, ids, { crs: source.crs })

        if (features.length === 0) {
            // Refetch returned nothing (non-numeric ID, network failure,
            // backend mismatch). Don't overwrite a populated stash with
            // emptiness — keep what the popup already showed.
            if (stashed) results.push(stashed)
            continue
        }

        const sublayerConfig = 'sublayers' in layer ? layer.sublayers?.[0] : undefined

        results.push({
            groupLayerTitle: layerTitle,
            layerTitle,
            sourceCRS: source.kind === 'wfs' ? (source.crs ?? 'EPSG:4326') : 'EPSG:4326',
            visible: true,
            popupFields: sublayerConfig?.popupFields,
            relatedTables: sublayerConfig?.relatedTables,
            linkFields: sublayerConfig?.linkFields,
            imageFields: sublayerConfig?.imageFields,
            colorCodingMap: sublayerConfig?.colorCodingMap,
            colorCodingMode: sublayerConfig?.colorCodingMode,
            features: features.map((f, idx): ExtendedFeature => ({
                type: 'Feature',
                id: f.id ?? `${layerTitle}-${idx}`,
                geometry: f.geometry,
                properties: (f.properties ?? {}) as GeoJsonProperties,
                namespace: layerTitle,
            })),
        })
    }

    return results
}

/**
 * Dual-source dispatch for "fetch this layer's features by ogc_fid":
 *
 * - **Parquet preferred** — if the layer carries `downloadParquetUrl` we hit
 *   it via DuckDB-WASM. Works regardless of how the layer is rendered (WMS
 *   tiles today, pmtiles tomorrow). No server endpoint needed.
 * - **WFS fallback** — for layers without parquet, derive a WFS endpoint from
 *   the layer's WMS/WFS config and query by `ogc_fid IN (...)`. Transitional;
 *   layers move to the parquet branch as soon as `downloadParquetUrl` is set.
 *
 * Returns null for layers we can't resolve at all (e.g. pure pmtiles with no
 * parquet yet) — callers should treat that as a "stash-only" layer.
 */
type FeatureSource =
    | { kind: 'parquet'; parquetUrl: string }
    | { kind: 'wfs'; wfsUrl: string; typeName: string; crs?: string }

function resolveFeatureSource(layer: LayerProps): FeatureSource | null {
    if (layer.downloadParquetUrl) {
        return { kind: 'parquet', parquetUrl: layer.downloadParquetUrl }
    }
    if (isWfsLayer(layer)) {
        return { kind: 'wfs', wfsUrl: layer.wfsUrl, typeName: layer.typeName, crs: layer.crs }
    }
    if (isWmsLayer(layer)) {
        const sublayerName = layer.sublayers?.[0]?.name
        if (!sublayerName || !layer.url) return null
        const parsed = parseWmsUrl(layer.url)
        if (!parsed) return null
        return { kind: 'wfs', wfsUrl: parsed.wfsUrl, typeName: sublayerName, crs: layer.crs }
    }
    return null
}

function isWfsLayer(layer: LayerProps): layer is WFSLayerProps {
    return (layer as { type?: string }).type === 'wfs'
}
function isWmsLayer(layer: LayerProps): layer is WMSLayerProps {
    return (layer as { type?: string }).type === 'wms'
}
