import { useMemo } from 'react';
import { ParquetDownloadMenu } from '@/components/maps/parquet-download-menu';
import { Spinner } from '@/components/ui/loading-spinner';
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs';
import { isPMTilesLayer, isWMSLayer } from '@/lib/map/layer-utils';
import type { LayerProps, RelatedTable } from '@/lib/types/mapping-types';

/**
 * Full-dataset downloads for the Data Sources panel, derived from the map's own
 * layer config — every layer publishing a `downloadParquetUrl` is listed, using
 * the same client-side export menu as the layer list.
 *
 * Nothing is hardcoded here: STAC-backed layers get their parquet URL filled in
 * from the warehouse item (see `mergeStacIntoLayer`), so a newly published
 * dataset appears in this list with no app change.
 */

interface DownloadableDataset {
    title: string;
    parquetUrl: string;
    relatedTables: RelatedTable[];
}

// Related tables hang off sublayer popup config; flattened so the export can bundle them.
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
    // Same query key as the sidebar layer list, so this is a cache hit rather than a second load.
    const { layerConfigs, isLoading } = useGetLayerConfigs('layers');

    const datasets = useMemo(() => {
        const found = collectDatasets(layerConfigs ?? []);
        const byUrl = new Map(found.map(d => [d.parquetUrl, d]));
        return [...byUrl.values()].sort((a, b) => a.title.localeCompare(b.title));
    }, [layerConfigs]);

    if (isLoading) return <div className="flex justify-center py-4"><Spinner /></div>;
    if (datasets.length === 0) return null;

    return (
        <div className="mx-2 mb-4 space-y-2">
            <h4 className="text-sm font-semibold">Download Datasets</h4>
            <p className="text-xs text-muted-foreground">
                Full datasets published by the UGS, in GeoParquet, GeoJSON, or CSV.
            </p>
            <ul className="space-y-1">
                {datasets.map(dataset => (
                    <li key={dataset.parquetUrl} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 break-words text-sm leading-tight">{dataset.title}</span>
                        <ParquetDownloadMenu
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
