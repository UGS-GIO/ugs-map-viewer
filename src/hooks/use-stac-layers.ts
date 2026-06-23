/**
 * STAC-driven layer loading.
 *
 * The platform direction: every serving layer is a STAC item in the warehouse
 * catalog, and the app resolves layers FROM that catalog rather than hardcoding
 * pmtiles URLs / styles / sprites / legends. An app declares a thin
 * {@link StacLayerAppConfig} (STAC item id + app-only UX); this hook fetches the
 * item(s) and produces the runtime `PMTilesLayerProps` the generic renders
 * engine consumes.
 *
 * This is the single integration point for the whole PMTiles migration — add a
 * layer by listing its STAC id, not by authoring style config.
 */
import { useQuery } from '@tanstack/react-query';
import type { PMTilesLayerProps } from '@/lib/types/mapping-types';
import {
    resolveStacPMTilesLayer,
    type StacItem,
    type StacLayerAppConfig,
} from '@/lib/map/stac/stac-layer';

// Serving-topics collection — the vector layers the viewer can render. Items
// live at `./<id>/<id>.json` relative to this URL.
const STAC_SERVING_TOPICS_COLLECTION =
    'https://maps-assets.geology.utah.gov/warehouse/stac/ugs-serving-topics/collection.json';

const STAC_STALE_TIME = 1000 * 60 * 30; // 30 min; catalog changes rarely

interface StacCollection {
    links?: Array<{ rel: string; href: string; title?: string }>;
}

/**
 * Fetch the serving-topics collection and build an `itemId → absolute item URL`
 * index from its `item` links. Resolving relative hrefs against the collection
 * URL keeps us robust if the path layout shifts.
 */
async function fetchItemIndex(): Promise<Record<string, string>> {
    const res = await fetch(STAC_SERVING_TOPICS_COLLECTION);
    if (!res.ok) throw new Error(`STAC collection fetch failed: ${res.status}`);
    const collection: StacCollection = await res.json();
    const index: Record<string, string> = {};
    for (const link of collection.links ?? []) {
        if (link.rel !== 'item' || !link.href) continue;
        const href = new URL(link.href, STAC_SERVING_TOPICS_COLLECTION).toString();
        const id = href.split('/').pop()?.replace(/\.json$/, '');
        if (id) index[id] = href;
    }
    return index;
}

async function fetchStacItem(href: string): Promise<StacItem> {
    const res = await fetch(href);
    if (!res.ok) throw new Error(`STAC item fetch failed: ${res.status}`);
    return res.json();
}

/**
 * Resolve a set of STAC-referencing app configs into runtime PMTiles layers.
 * Fetches the catalog index once, then each referenced item, and merges with the
 * app UX via {@link resolveStacPMTilesLayer}. Returns layers in input order.
 */
export function useStacPMTilesLayers(appConfigs: StacLayerAppConfig[]) {
    const ids = appConfigs.map(c => c.stacItemId);
    return useQuery<PMTilesLayerProps[]>({
        queryKey: ['stac', 'pmtiles-layers', [...ids].sort()],
        queryFn: async () => {
            const index = await fetchItemIndex();
            return Promise.all(appConfigs.map(async (cfg) => {
                const href = index[cfg.stacItemId];
                if (!href) throw new Error(`STAC item '${cfg.stacItemId}' not found in serving-topics collection`);
                const item = await fetchStacItem(href);
                return resolveStacPMTilesLayer(item, cfg);
            }));
        },
        enabled: appConfigs.length > 0,
        staleTime: STAC_STALE_TIME,
    });
}

/** Single-item convenience wrapper over {@link useStacPMTilesLayers}. */
export function useStacPMTilesLayer(appConfig: StacLayerAppConfig | null) {
    const query = useStacPMTilesLayers(appConfig ? [appConfig] : []);
    return { ...query, data: query.data?.[0] };
}
