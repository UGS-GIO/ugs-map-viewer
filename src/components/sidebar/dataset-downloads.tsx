import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ParquetDownloadMenu } from '@/components/maps/parquet-download-menu';
import { Spinner } from '@/components/ui/loading-spinner';
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs';
import { useGetCurrentPage } from '@/hooks/use-get-current-page';
import { EXPORT_DISABLED_PAGES, MAPS_ASSETS_CDN_URL } from '@/lib/constants';
import { isPMTilesLayer, isWMSLayer } from '@/lib/map/layer-utils';
import { fetchStacItem, fetchStacItemIndex } from '@/lib/map/stac/stac-layer';
import type { LayerProps, RelatedTable } from '@/lib/types/mapping-types';

/** Data Sources panel downloads: every layer carrying a `downloadParquetUrl`. */

interface DownloadableDataset {
    title: string;
    /** null when the layer publishes no parquet — listed, but with nothing to download. */
    parquetUrl: string | null;
    relatedTables: RelatedTable[];
}

// Same CDN host either way; warehouse assets live under `/warehouse/`.
const isWarehouseParquet = (url: string) => new URL(url, MAPS_ASSETS_CDN_URL).pathname.startsWith('/warehouse/');

/** `/parquet/hazards_qfaults/hazards_qfaults.parquet` → `hazards_qfaults`, to match against STAC ids. */
const stemOf = (url: string) => new URL(url, MAPS_ASSETS_CDN_URL).pathname.split('/').pop()?.replace(/\.parquet$/, '') ?? '';

const relatedTablesOf = (layer: LayerProps): RelatedTable[] =>
    isWMSLayer(layer) || isPMTilesLayer(layer)
        ? layer.sublayers?.flatMap(sub => sub.relatedTables ?? []) ?? []
        : [];

// Our own services only — external ones (e.g. SITLA land ownership) aren't ours to serve.
const collectDatasets = (layers: LayerProps[]): DownloadableDataset[] =>
    layers.flatMap(layer => {
        if ('layers' in layer && Array.isArray(layer.layers)) return collectDatasets(layer.layers);
        if (!layer.title || !(isWMSLayer(layer) || isPMTilesLayer(layer))) return [];
        return [{
            title: layer.title,
            parquetUrl: layer.downloadParquetUrl ?? null,
            relatedTables: relatedTablesOf(layer),
        }];
    });

export function DatasetDownloads() {
    const currentPage = useGetCurrentPage();
    // Same query key as the sidebar layer list — cache hit, not a second load.
    const { layerConfigs, isLoading } = useGetLayerConfigs('layers');

    const all = useMemo(() => {
        const byTitle = new Map(collectDatasets(layerConfigs ?? []).map(d => [d.title, d]));
        return [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title));
    }, [layerConfigs]);

    const stems = useMemo(
        () => [...new Set(all.filter(d => d.parquetUrl).map(d => stemOf(d.parquetUrl!)))].sort(),
        [all],
    );

    // A hand-authored CDN parquet whose stem is in the catalog gets upgraded to the
    // warehouse copy, so datasets migrate without editing every layer config.
    const { data: warehouseByStem } = useQuery({
        queryKey: ['dataset-downloads-warehouse-parquet', stems],
        queryFn: async () => {
            const index = await fetchStacItemIndex();
            const entries = await Promise.all(
                stems.filter(s => index[s]).map(async s => {
                    const item = await fetchStacItem(index[s]);
                    return [s, item.assets?.data?.href] as const;
                }),
            );
            return Object.fromEntries(entries.filter(([, href]) => href)) as Record<string, string>;
        },
        enabled: stems.length > 0,
        staleTime: 30 * 60 * 1000,
    });

    const { catalogued, staged, unavailable } = useMemo(() => {
        const resolved = all.map(d => ({
            ...d,
            parquetUrl: d.parquetUrl ? warehouseByStem?.[stemOf(d.parquetUrl)] ?? d.parquetUrl : null,
        }));
        return {
            catalogued: resolved.filter(d => d.parquetUrl && isWarehouseParquet(d.parquetUrl)),
            staged: resolved.filter(d => d.parquetUrl && !isWarehouseParquet(d.parquetUrl)),
            unavailable: resolved.filter(d => !d.parquetUrl),
        };
    }, [all, warehouseByStem]);

    if (EXPORT_DISABLED_PAGES.includes(currentPage)) return null;
    if (isLoading) return <div className="flex justify-center py-4"><Spinner /></div>;
    if (all.length === 0) return null;

    return (
        <div className="mx-2 mb-4 space-y-3">
            <div>
                <h4 className="text-sm font-semibold">Download Datasets</h4>
                <p className="text-xs text-muted-foreground">
                    Full datasets, in GeoParquet, GeoJSON, or CSV.
                </p>
            </div>
            <DatasetGroup
                heading="Published datasets"
                hint="Catalogued in the UGS data warehouse."
                datasets={catalogued}
            />
            <DatasetGroup
                heading="Provisional datasets"
                hint="Not yet catalogued in the data warehouse; locations may change."
                datasets={staged}
            />
            <DatasetGroup
                heading="Download not available"
                hint="These layers aren't published for download."
                datasets={unavailable}
            />
        </div>
    );
}

function DatasetGroup({ heading, hint, datasets }: { heading: string; hint: string; datasets: DownloadableDataset[] }) {
    if (datasets.length === 0) return null;
    return (
        <div className="space-y-1">
            <h5 className="text-xs font-semibold text-muted-foreground">{heading}</h5>
            <p className="text-xs text-muted-foreground">{hint}</p>
            {/* Grid keeps buttons in one column when titles wrap. */}
            <ul className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
                {datasets.map(dataset => (
                    <li key={dataset.title} className="contents">
                        <span className="min-w-0 break-words text-sm leading-tight">{dataset.title}</span>
                        {dataset.parquetUrl
                            ? <ParquetDownloadMenu
                                compact
                                parquetUrl={dataset.parquetUrl}
                                layerTitle={dataset.title}
                                relatedTables={dataset.relatedTables}
                            />
                            : <span className="shrink-0 text-xs text-muted-foreground">—</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
}
