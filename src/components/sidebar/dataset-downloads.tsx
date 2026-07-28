import { useMemo } from 'react';
import { ParquetDownloadMenu } from '@/components/maps/parquet-download-menu';
import { Spinner } from '@/components/ui/loading-spinner';
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs';
import { useGetCurrentPage } from '@/hooks/use-get-current-page';
import { EXPORT_DISABLED_PAGES, MAPS_ASSETS_CDN_URL } from '@/lib/constants';
import { isPMTilesLayer, isWMSLayer } from '@/lib/map/layer-utils';
import type { LayerProps, RelatedTable } from '@/lib/types/mapping-types';

/**
 * Full-dataset downloads for the Data Sources panel: every layer carrying a
 * `downloadParquetUrl`, through the same export menu as the layer list. STAC-backed
 * layers get that URL from the warehouse item, so new datasets need no app change.
 */

interface DownloadableDataset {
    title: string;
    parquetUrl: string;
    relatedTables: RelatedTable[];
}

// Same CDN host either way — warehouse assets are the ones under `/warehouse/`.
const isWarehouseParquet = (url: string) => new URL(url, MAPS_ASSETS_CDN_URL).pathname.startsWith('/warehouse/');

const relatedTablesOf = (layer: LayerProps): RelatedTable[] =>
    isWMSLayer(layer) || isPMTilesLayer(layer)
        ? layer.sublayers?.flatMap(sub => sub.relatedTables ?? []) ?? []
        : [];

const collectDatasets = (layers: LayerProps[]): DownloadableDataset[] =>
    layers.flatMap(layer => {
        if ('layers' in layer && Array.isArray(layer.layers)) return collectDatasets(layer.layers);
        if (!layer.downloadParquetUrl || !layer.title) return [];
        return [{
            title: layer.title,
            parquetUrl: layer.downloadParquetUrl,
            relatedTables: relatedTablesOf(layer),
        }];
    });

export function DatasetDownloads() {
    const currentPage = useGetCurrentPage();
    // Same query key as the sidebar layer list — cache hit, not a second load.
    const { layerConfigs, isLoading } = useGetLayerConfigs('layers');

    const { catalogued, staged } = useMemo(() => {
        const byUrl = new Map(collectDatasets(layerConfigs ?? []).map(d => [d.parquetUrl, d]));
        const all = [...byUrl.values()].sort((a, b) => a.title.localeCompare(b.title));
        return {
            catalogued: all.filter(d => isWarehouseParquet(d.parquetUrl)),
            staged: all.filter(d => !isWarehouseParquet(d.parquetUrl)),
        };
    }, [layerConfigs]);

    if (EXPORT_DISABLED_PAGES.includes(currentPage)) return null;
    if (isLoading) return <div className="flex justify-center py-4"><Spinner /></div>;
    if (catalogued.length === 0 && staged.length === 0) return null;

    return (
        <div className="mx-2 mb-4 space-y-3">
            <div>
                <h4 className="text-sm font-semibold">Download Datasets</h4>
                <p className="text-xs text-muted-foreground">
                    Full datasets published by the UGS, in GeoParquet, GeoJSON, or CSV.
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
                    <li key={dataset.parquetUrl} className="contents">
                        <span className="min-w-0 break-words text-sm leading-tight">{dataset.title}</span>
                        <ParquetDownloadMenu
                            compact
                            parquetUrl={dataset.parquetUrl}
                            layerTitle={dataset.title}
                            relatedTables={dataset.relatedTables}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}
