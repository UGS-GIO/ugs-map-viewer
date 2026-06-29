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
    fetchStacItem,
    fetchStacItemIndex,
    resolveStacPMTilesLayer,
    type StacLayerAppConfig,
} from '@/lib/map/stac/stac-layer';

const STAC_STALE_TIME = 1000 * 60 * 30; // 30 min; catalog changes rarely

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
            const index = await fetchStacItemIndex();
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
