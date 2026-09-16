import type { StacItem } from '@/lib/map/stac/stac-layer'
import { fetchStacItemIndex, stacItemHref } from '@/lib/map/stac/stac-layer'
import { titleFromUrl } from '@/lib/map/user-layers/detect'

export const DEFAULT_STAC_CATALOG_URL =
    'https://maps-assets.geology.utah.gov/warehouse/stac/catalog.json'

export interface StacChildLink {
    title: string
    href: string
    itemCount?: number
    mappableCount?: number
}

export interface StacItemSummary {
    id: string
    title: string
    href: string
    format: 'pmtiles' | 'cog' | 'geojson' | 'other'
    description?: string
}

export interface StacCatalogNode {
    kind: 'catalog' | 'collection'
    id: string
    title: string
    description?: string
    url: string
    rootUrl?: string
    parentUrl?: string
    children: StacChildLink[]
    items: StacItemSummary[]
}

export interface StacItemNode {
    kind: 'item'
    id: string
    title: string
    url: string
    item: StacItem
    format: 'pmtiles' | 'cog' | 'geojson' | 'other'
}

export type StacNode = StacCatalogNode | StacItemNode

export function isStacCatalogOrCollection(node: StacNode): node is StacCatalogNode {
    return node.kind === 'catalog' || node.kind === 'collection'
}

export function detectStacItemFormat(item: { assets?: Record<string, { type?: string; roles?: string[]; href?: string }> }): 'pmtiles' | 'cog' | 'geojson' | 'other' {
    const assets = Object.values(item.assets ?? {})
    if (assets.some(a => a.type === 'application/vnd.pmtiles' || a.href?.endsWith('.pmtiles'))) {
        return 'pmtiles'
    }
    if (assets.some(a => a.type?.includes('image/tiff') || a.type?.includes('geotiff') || a.href?.match(/\.(tif|tiff)$/i))) {
        return 'cog'
    }
    if (assets.some(a => a.type?.includes('geo+json') || a.href?.endsWith('.geojson'))) {
        return 'geojson'
    }
    return 'other'
}

/**
 * Fetch and inspect any STAC URL or item ID. Returns either an Item node
 * (ready to add as a layer) or a Catalog/Collection node with discoverable
 * children and items.
 */
export async function fetchStacNode(urlOrId: string, currentUrl?: string): Promise<StacNode> {
    const trimmed = urlOrId.trim()
    if (!trimmed) throw new Error('Enter a STAC URL or item id.')

    const isUrl = /^https?:\/\//i.test(trimmed)
    if (!isUrl && !trimmed.includes('/') && !trimmed.includes('.')) {
        // Bare item id — resolve via default serving-topics index
        const index = await fetchStacItemIndex()
        const entry = index[trimmed]
        if (!entry) throw new Error(`STAC item '${trimmed}' not found in serving-topics index`)
        const href = stacItemHref(entry) ?? `${DEFAULT_STAC_CATALOG_URL}`
        return {
            kind: 'item',
            id: entry.id,
            title: (entry.properties?.title as string | undefined) || entry.id,
            url: href,
            item: entry,
            format: detectStacItemFormat(entry),
        }
    }

    const resolvedUrl = currentUrl ? new URL(trimmed, currentUrl).href : trimmed
    const res = await fetch(resolvedUrl)
    if (!res.ok) throw new Error(`STAC request failed: HTTP ${res.status} for ${resolvedUrl}`)
    const doc = (await res.json()) as Record<string, unknown>

    // Check if it is a single STAC Item. `type` is authoritative when present —
    // STAC 1.0 lets a Catalog/Collection carry its own top-level `assets`, so the
    // asset sniff below is only a fallback for documents with no `type` at all.
    const isItem =
        doc.type === 'Feature' ||
        (doc.type !== 'Catalog' &&
            doc.type !== 'Collection' &&
            !!doc.assets &&
            typeof doc.assets === 'object' &&
            Object.values(doc.assets as Record<string, { type?: string; href?: string }>).some(
                a => a.type?.includes('pmtiles') || a.type?.includes('tiff') || a.href?.match(/\.(pmtiles|tif|tiff)$/i),
            ))

    if (isItem) {
        const item = doc as unknown as StacItem
        return {
            kind: 'item',
            id: item.id,
            title: (item.properties?.title as string | undefined) || item.id,
            url: resolvedUrl,
            item,
            format: detectStacItemFormat(item),
        }
    }

    // Catalog or Collection
    const links = (Array.isArray(doc.links) ? doc.links : []) as Array<Record<string, unknown>>

    // Child catalogs / collections
    const children: StacChildLink[] = links
        .filter(l => l.rel === 'child' || l.rel === 'collection' || l.rel === 'collections')
        .map(l => ({
            title: (l.title as string) || (l.id as string) || titleFromUrl(String(l.href)),
            href: new URL(String(l.href), resolvedUrl).href,
            itemCount: typeof l['ugs:item_count'] === 'number' ? (l['ugs:item_count'] as number) : undefined,
            mappableCount: typeof l['ugs:mappable_count'] === 'number' ? (l['ugs:mappable_count'] as number) : undefined,
        }))

    // Items
    let items: StacItemSummary[] = []

    // 1. Direct rel === "item" links
    const itemLinks = links.filter(l => l.rel === 'item')
    if (itemLinks.length > 0) {
        items = itemLinks.map(l => {
            const href = new URL(String(l.href), resolvedUrl).href
            return {
                id: (l.id as string) || (l.title as string) || titleFromUrl(href),
                title: (l.title as string) || (l.id as string) || titleFromUrl(href),
                href,
                format: 'other',
            }
        })
    }

    // 2. Check for items index (e.g. ugs-items-index pointing to items.json)
    const indexLink = links.find(l => l.rel === 'ugs-items-index')
    if (indexLink && typeof indexLink.href === 'string') {
        try {
            const indexUrl = new URL(indexLink.href, resolvedUrl).href
            const indexRes = await fetch(indexUrl)
            if (indexRes.ok) {
                const indexDoc = (await indexRes.json()) as { items?: Array<StacItem> }
                if (Array.isArray(indexDoc.items)) {
                    items = indexDoc.items.map(it => {
                        const itLinks = (it as unknown as { links?: Array<{ rel: string; href: string }> }).links
                        const selfLink = itLinks?.find(l => l.rel === 'self')
                        const itemHref = selfLink
                            ? new URL(selfLink.href, indexUrl).href
                            : stacItemHref(it) || `${resolvedUrl}#${it.id}`
                        const renderTitle = (it.properties?.['ugs:renders'] as Record<string, { title?: string }> | undefined)?.default?.title
                        const displayTitle = renderTitle || (it.properties?.title as string | undefined) || it.id
                        return {
                            id: it.id,
                            title: displayTitle,
                            href: itemHref,
                            format: detectStacItemFormat(it),
                            description: it.properties?.['ugs:layer'] as string | undefined,
                        }
                    })
                }
            }
        } catch (e) {
            console.warn('[stac-explorer] Failed to fetch items index:', e)
        }
    }

    // 3. ItemCollection or STAC API features array
    if (items.length === 0 && Array.isArray(doc.features)) {
        items = (doc.features as StacItem[]).map(f => {
            const fLinks = (f as unknown as { links?: Array<{ rel: string; href: string }> }).links
            const selfLink = fLinks?.find(l => l.rel === 'self')
            const href = selfLink ? new URL(selfLink.href, resolvedUrl).href : resolvedUrl
            return {
                id: f.id,
                title: (f.properties?.title as string | undefined) || f.id,
                href,
                format: detectStacItemFormat(f),
            }
        })
    }

    const rootLink = links.find(l => l.rel === 'root')
    const parentLink = links.find(l => l.rel === 'parent')

    return {
        kind: doc.type === 'Collection' ? 'collection' : 'catalog',
        id: (doc.id as string) || titleFromUrl(resolvedUrl),
        title: (doc.title as string) || (doc.id as string) || titleFromUrl(resolvedUrl),
        description: doc.description as string | undefined,
        url: resolvedUrl,
        rootUrl: rootLink ? new URL(String(rootLink.href), resolvedUrl).href : undefined,
        parentUrl: parentLink ? new URL(String(parentLink.href), resolvedUrl).href : undefined,
        children,
        items,
    }
}
