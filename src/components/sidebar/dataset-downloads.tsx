import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { ParquetDownloadMenu } from '@/components/maps/parquet-download-menu';
import { Spinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs';
import { useGetCurrentPage } from '@/hooks/use-get-current-page';
import { EXPORT_DISABLED_PAGES, MAPS_ASSETS_CDN_URL } from '@/lib/constants';
import { isPMTilesLayer, isWMSLayer } from '@/lib/map/layer-utils';
import { fetchStacItem, fetchStacItemIndex } from '@/lib/map/stac/stac-layer';
import type { LayerProps, RelatedTable } from '@/lib/types/mapping-types';

interface DownloadableDataset {
    title: string;
    parquetUrl: string | null;
    relatedTables: RelatedTable[];
    sourceAgency?: string;
    sourceUrl?: string;
}

// e.g. `/parquet/hazards_qfaults/hazards_qfaults.parquet` → `hazards_qfaults`
const stemOf = (url: string) => new URL(url, MAPS_ASSETS_CDN_URL).pathname.split('/').pop()?.replace(/\.parquet$/, '') ?? '';

const relatedTablesOf = (layer: LayerProps): RelatedTable[] =>
    isWMSLayer(layer) || isPMTilesLayer(layer)
        ? layer.sublayers?.flatMap(sub => sub.relatedTables ?? []) ?? []
        : [];

const collectDatasets = (layers: LayerProps[]): DownloadableDataset[] =>
    layers.flatMap(layer => {
        if ('layers' in layer && Array.isArray(layer.layers)) return collectDatasets(layer.layers);
        if (!layer.title || !(isWMSLayer(layer) || isPMTilesLayer(layer))) return [];
        return [{
            title: layer.title,
            parquetUrl: layer.downloadParquetUrl ?? null,
            relatedTables: relatedTablesOf(layer),
            sourceAgency: layer.sourceAgency,
            sourceUrl: layer.sourceUrl,
        }];
    });

export function DatasetDownloads() {
    const currentPage = useGetCurrentPage();
    const { layerConfigs, isLoading } = useGetLayerConfigs('layers');

    const all = useMemo(() => {
        const byTitle = new Map(collectDatasets(layerConfigs ?? []).map(d => [d.title, d]));
        return [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title));
    }, [layerConfigs]);

    const stems = useMemo(
        () => [...new Set(all.filter(d => d.parquetUrl).map(d => stemOf(d.parquetUrl!)))].sort(),
        [all],
    );

    // Upgrades a hand-authored CDN parquet to its warehouse copy by stem match.
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

    const { available } = useMemo(() => {
        const resolved = all.map(d => ({
            ...d,
            parquetUrl: d.parquetUrl ? warehouseByStem?.[stemOf(d.parquetUrl)] ?? d.parquetUrl : null,
        }));
        return {
            available: resolved.filter(d => d.parquetUrl),
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
            </div>
            <DatasetGroup datasets={available} />
        </div>
    );
}

function DatasetGroup({ heading, datasets }: { heading?: string; datasets: DownloadableDataset[] }) {
    if (datasets.length === 0) return null;
    return (
        <div className="space-y-1">
            {heading && <h5 className="text-xs font-semibold text-muted-foreground">{heading}</h5>}
            <ul className="grid grid-cols-[1fr_auto] items-start gap-x-2 gap-y-3">
                {datasets.map(dataset => (
                    <li key={dataset.title} className="contents">
                        <span className="min-w-0 break-words leading-tight">
                            <span className="block text-sm">{dataset.title}</span>
                            {dataset.sourceAgency && (
                                <span className="block text-xs text-muted-foreground">{dataset.sourceAgency}</span>
                            )}
                        </span>
                        {dataset.parquetUrl
                            ? <ParquetDownloadMenu
                                compact
                                parquetUrl={dataset.parquetUrl}
                                layerTitle={dataset.title}
                                relatedTables={dataset.relatedTables}
                            />
                            : dataset.sourceUrl
                                ? <Button
                                    asChild
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                >
                                    <Link to={dataset.sourceUrl} aria-label={`View ${dataset.title} source`}>
                                        <ExternalLink className="h-4 w-4" />
                                    </Link>
                                </Button>
                                : <span className="shrink-0 text-xs text-muted-foreground">—</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
}
