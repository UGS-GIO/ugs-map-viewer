import { Info, Shrink, TableOfContents, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { LegendAccordion } from '@/components/maps/legend-accordion';
import { useEffect, useState, useMemo } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { LayerDescriptionAccordion } from '@/components/maps/layer-description-accordion';
import { downloadLayerAsGeoJSON } from '@/lib/download-utils';
import { exportParquetToGeoJSON, downloadParquet } from '@/lib/duckdb-export';
import { useMutation } from '@tanstack/react-query';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Bucket URL for pre-built exports (empty = use live WFS)
const EXPORTS_BUCKET_BASE = import.meta.env.VITE_EXPORTS_BUCKET_URL || '';

// Map GeoServer workspaces to app names
const WORKSPACE_TO_APP: Record<string, string> = {
    'hazards': 'hazards',
    'energy_mineral': 'carbonstorage',
    'minerals': 'minerals',
    'wetlands': 'wetlands',
    'wetlandplants': 'wetlandplants',
    'geophysics': 'geophysics',
};

interface LayerControlsProps {
    handleZoomToLayer: () => void;
    layerOpacity: number | null;
    handleOpacityChange: (e: number) => void;
    title: string;
    description: string;
    layerId: string;
    url: string;
    openLegend?: boolean;
    /** Full layer name for WFS download (e.g., "hazards:quaternaryfaults_current") */
    layerName?: string | null;
}

/** Extract app name from layer workspace (e.g., "hazards:layer" -> "hazards") */
const getAppFromLayerName = (name: string): string | null => {
    const workspace = name.split(':')[0];
    return WORKSPACE_TO_APP[workspace] || null;
};

/** Get safe filename for bucket path */
const getSafeFilename = (layerTitle: string): string => {
    return layerTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
};

const LayerControls: React.FC<LayerControlsProps> = ({
    handleZoomToLayer,
    layerOpacity,
    handleOpacityChange,
    description,
    title,
    layerId,
    url,
    openLegend,
    layerName,
}) => {
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);
    const [cleanDescription, setCleanDescription] = useState<string>('');
    const [exportStatus, setExportStatus] = useState<string | null>(null);

    // Check if pre-built exports are available
    const prebuiltAvailable = !!EXPORTS_BUCKET_BASE;

    // Derived values
    const app = useMemo(() => layerName ? getAppFromLayerName(layerName) : null, [layerName]);
    const safeName = useMemo(() => getSafeFilename(title), [title]);
    const parquetUrl = useMemo(
        () => prebuiltAvailable && app ? `${EXPORTS_BUCKET_BASE}/${app}/${safeName}.parquet` : null,
        [prebuiltAvailable, app, safeName]
    );

    // Export GeoJSON mutation
    const exportGeoJSON = useMutation({
        mutationFn: async () => {
            if (parquetUrl) {
                // Use pre-built Parquet, convert to GeoJSON in browser
                await exportParquetToGeoJSON({
                    parquetUrl,
                    filename: safeName,
                    onProgress: (p) => setExportStatus(p.message),
                });
            } else if (url && layerName) {
                // Fallback to live WFS
                await downloadLayerAsGeoJSON(url, layerName, title, (_percent, fetched, total) => {
                    const totalStr = total ? ` / ${total.toLocaleString()}` : '';
                    setExportStatus(`${fetched.toLocaleString()}${totalStr} features`);
                });
            }
        },
        onSettled: () => setExportStatus(null),
    });

    // Export Parquet mutation
    const exportParquet = useMutation({
        mutationFn: async () => {
            if (!parquetUrl) throw new Error('Pre-built exports not available');
            setExportStatus('Downloading...');
            await downloadParquet(parquetUrl, safeName);
        },
        onSettled: () => setExportStatus(null),
    });

    // Live WFS export mutation
    const exportLiveWFS = useMutation({
        mutationFn: async () => {
            if (!url || !layerName) throw new Error('Missing URL or layer name');
            await downloadLayerAsGeoJSON(url, layerName, title, (_percent, fetched, total) => {
                const totalStr = total ? ` / ${total.toLocaleString()}` : '';
                setExportStatus(`${fetched.toLocaleString()}${totalStr} features`);
            });
        },
        onSettled: () => setExportStatus(null),
    });

    // Combined loading state
    const isExporting = exportGeoJSON.isPending || exportParquet.isPending || exportLiveWFS.isPending;

    // Sync openLegend prop to accordion state
    useEffect(() => {
        if (openLegend) {
            setOpenAccordion('legend');
        }
    }, [openLegend]);

    // Lazy load DOMPurify only when description changes
    useEffect(() => {
        if (description) {
            import('dompurify').then(({ default: DOMPurify }) => {
                const sanitized = DOMPurify.sanitize(description, {
                    USE_PROFILES: { html: true },
                    ALLOWED_ATTR: ['target', 'href'],
                    ADD_ATTR: ['target']
                });
                setCleanDescription(sanitized);
            });
        }
    }, [description]);

    const infoPressed = openAccordion === 'info';
    const legendPressed = openAccordion === 'legend';

    const handleToggle = (type: 'info' | 'legend') => {
        setOpenAccordion(current => (current === type ? null : type));
    };

    const canDownload = !!url && !!layerName;

    return (
        <div className="flex flex-col gap-y-4 pt-2">
            <div className="flex flex-col gap-y-4 mx-8">
                <div className="flex flex-col justify-between items-center w-full gap-y-4">
                    <div className="flex flex-row items-center justify-around gap-x-2 w-full mx-auto">
                        <Label htmlFor={`${title}-opacity`} className={layerOpacity === null ? 'text-muted-foreground' : ''}>
                            Opacity
                        </Label>
                        {layerOpacity !== null ? (
                            <Slider
                                className="flex-grow"
                                defaultValue={[layerOpacity * 100]}
                                onValueChange={(e) => handleOpacityChange(e[0])}
                            />
                        ) : (
                            <Slider
                                className="flex-grow opacity-50"
                                defaultValue={[100]}
                                disabled
                            />
                        )}
                    </div>

                    <div className="flex flex-wrap justify-center items-stretch w-full gap-2">
                        <Toggle
                            aria-label="Toggle info"
                            size="stacked"
                            className="flex flex-col items-center p-2 min-w-[70px] flex-1 gap-1"
                            pressed={infoPressed}
                            onPressedChange={() => handleToggle('info')}
                        >
                            <Info className="h-5 w-5" />
                            <span className='text-xs'>Info</span>
                        </Toggle>

                        <Button
                            variant="ghost"
                            size="stacked"
                            className="flex flex-col items-center p-2 min-w-[70px] flex-1 gap-1"
                            onClick={handleZoomToLayer}
                        >
                            <Shrink className="h-5 w-5" />
                            <span className='text-xs'>Zoom to</span>
                        </Button>

                        <Toggle
                            aria-label="Toggle legend"
                            size="stacked"
                            className="flex flex-col items-center p-2 min-w-[70px] flex-1 gap-1"
                            pressed={legendPressed}
                            onPressedChange={() => handleToggle('legend')}
                        >
                            <TableOfContents className="h-5 w-5" />
                            <span className='text-xs'>Legend</span>
                        </Toggle>

                        {canDownload && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="stacked"
                                        className="flex flex-col items-center p-2 min-w-[70px] flex-1 gap-1"
                                        disabled={isExporting}
                                    >
                                        {isExporting ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <Download className="h-5 w-5" />
                                        )}
                                        <span className='text-xs'>
                                            {exportStatus || 'Export'}
                                        </span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center" side="top">
                                    <DropdownMenuItem onClick={() => exportGeoJSON.mutate()}>
                                        GeoJSON
                                        {prebuiltAvailable && (
                                            <span className="ml-2 text-xs text-muted-foreground">(fast)</span>
                                        )}
                                    </DropdownMenuItem>
                                    {prebuiltAvailable && (
                                        <DropdownMenuItem onClick={() => exportParquet.mutate()}>
                                            Parquet
                                            <span className="ml-2 text-xs text-muted-foreground">(smallest)</span>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => exportLiveWFS.mutate()}
                                        className="text-muted-foreground"
                                    >
                                        Live from server
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <LayerDescriptionAccordion
                    isOpen={infoPressed}
                    description={cleanDescription}
                />
                <LegendAccordion
                    isOpen={legendPressed}
                    layerId={layerId}
                    url={url}
                    layerName={layerName}
                />
            </div>
        </div>
    );
};

export default LayerControls;
