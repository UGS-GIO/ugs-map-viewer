import { Info, Shrink, TableOfContents, SlidersHorizontal, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { LegendAccordion } from '@/components/maps/legend-accordion';
import { useRef, useState } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { LayerDescriptionAccordion } from '@/components/maps/layer-description-accordion';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { ParquetDownloadMenu } from '@/components/maps/parquet-download-menu';
import type { RelatedTable } from '@/lib/types/mapping-types';

interface LayerControlsProps {
    handleZoomToLayer: () => void;
    layerOpacity: number | null;
    handleOpacityChange: (e: number) => void;
    handleOpacityCommit: (e: number) => void;
    title: string;
    description: string;
    url: string;
    openLegend?: boolean;
    layerName?: string | null;
    customLegend?: React.ReactNode;
    bivariateLegend?: { xLabel: string; yLabel: string };
    arcgisUrl?: string;
    legendUnit?: string;
    /** Maps a GeoServer sublayer name to a friendly heading, for delineating sublayers in the legend. */
    layerLabels?: Record<string, string>;
    /** Downloadable datasets for this layer. One entry per dataset (a multi-sublayer layer exposes one
     * per sublayer); each renders its own labelled download menu and bundles its related tables
     * (e.g. formation tops, geochemistry) into the "Include related data" zip. */
    downloadEntries?: Array<{ label: string; url: string; relatedTables?: RelatedTable[] }>;
    /** When true, hide format-conversion dropdown and offer only a direct parquet download. Used for apps that require unmodified source data. */
    disableExport?: boolean;
    /** Optional layer-scoped filter UI. When provided, adds a Filters toggle to the button row and a collapsible panel below. */
    filtersContent?: React.ReactNode;
    /** Optional layer-scoped stats / charts UI. When provided, adds a Stats toggle to the button row and a collapsible panel below. */
    statsContent?: React.ReactNode;
}

const LayerControls: React.FC<LayerControlsProps> = ({
    handleZoomToLayer,
    layerOpacity,
    handleOpacityChange,
    handleOpacityCommit,
    description,
    title,
    url,
    openLegend,
    layerName,
    customLegend,
    bivariateLegend,
    arcgisUrl,
    legendUnit,
    layerLabels,
    downloadEntries = [],
    disableExport = false,
    filtersContent,
    statsContent,
}) => {
    // Info + Legend remain a single-select pair (mutually exclusive — they both
    // describe the layer and stacking them is redundant). Filters + Stats each
    // get their own independent open state so reviewers can keep both visible
    // alongside Info or Legend if they want.
    const [prevOpenLegend, setPrevOpenLegend] = useState(openLegend);
    const [activeTab, setActiveTab] = useState<'info' | 'legend' | null>(openLegend ? 'legend' : null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [statsOpen, setStatsOpen] = useState(false);

    if (openLegend !== prevOpenLegend) {
        setPrevOpenLegend(openLegend);
        if (openLegend) setActiveTab('legend');
    }

    const [dragValue, setDragValue] = useState<number | null>(null);
    const lastOpacityRef = useRef(layerOpacity ?? 1);

    if (layerOpacity !== null) {
        lastOpacityRef.current = layerOpacity;
    }

    // Lazy-load DOMPurify and cache sanitized descriptions
    const { data: cleanDescription = '' } = useQuery({
        queryKey: [...queryKeys.modules.dompurify(), description],
        queryFn: async () => {
            if (!description) return '';
            const DOMPurify = (await import('dompurify')).default;
            return DOMPurify.sanitize(description, {
                USE_PROFILES: { html: true },
                ALLOWED_ATTR: ['target', 'href'],
                ADD_ATTR: ['target']
            });
        },
        enabled: !!description,
        staleTime: Infinity,
    });

    const infoPressed = activeTab === 'info';
    const legendPressed = activeTab === 'legend';

    const handleToggle = (type: 'info' | 'legend') => {
        setActiveTab(current => (current === type ? null : type));
    };

    return (
        <div className="flex flex-col gap-y-2 pt-2">
            <div className="flex flex-col gap-y-4 mx-8">
                <div className="flex flex-col justify-between items-center w-full gap-y-4">
                    <div className="flex flex-row items-center justify-around gap-x-2 w-full mx-auto" data-tour="layer-opacity">
                        <Label htmlFor={`${title}-opacity`} className={layerOpacity === null ? 'text-muted-foreground' : ''}>
                            Opacity
                        </Label>
                        {layerOpacity !== null ? (
                            <Slider
                                className="flex-grow"
                                value={[dragValue ?? layerOpacity * 100]}
                                onValueChange={(e) => {
                                    setDragValue(e[0]);
                                    handleOpacityChange(e[0]);
                                }}
                                onValueCommit={(e) => {
                                    setDragValue(null); // Clear local drag state so it syncs back with the URL
                                    handleOpacityCommit(e[0]);
                                }}
                            />
                        ) : (
                            <Slider
                                className="flex-grow opacity-50"
                                value={[lastOpacityRef.current * 100]}
                                disabled
                            />
                        )}
                    </div>

                    <div className="flex flex-wrap justify-center items-stretch w-full gap-2">
                        <Toggle
                            aria-label="Toggle info"
                            size="stacked"
                            className="flex flex-col items-center px-3 py-2 min-w-[80px] basis-[calc((100%-1rem)/3)] grow-0 gap-1"
                            pressed={infoPressed}
                            onPressedChange={() => handleToggle('info')}
                        >
                            <Info className="h-5 w-5" />
                            <span className='text-xs'>Info</span>
                        </Toggle>

                        <Button
                            variant="ghost"
                            size="stacked"
                            className="flex flex-col items-center px-3 py-2 min-w-[80px] basis-[calc((100%-1rem)/3)] grow-0 gap-1"
                            onClick={handleZoomToLayer}
                        >
                            <Shrink className="h-5 w-5" />
                            <span className='text-xs'>Zoom to</span>
                        </Button>

                        <Toggle
                            aria-label="Toggle legend"
                            size="stacked"
                            className="flex flex-col items-center px-3 py-2 min-w-[80px] basis-[calc((100%-1rem)/3)] grow-0 gap-1"
                            pressed={legendPressed}
                            onPressedChange={() => handleToggle('legend')}
                            data-tour="layer-legend"
                        >
                            <TableOfContents className="h-5 w-5" />
                            <span className='text-xs'>Legend</span>
                        </Toggle>

                        {!disableExport && downloadEntries.map(d => (
                            <ParquetDownloadMenu
                                key={d.url}
                                parquetUrl={d.url}
                                layerTitle={downloadEntries.length > 1 ? `${title}-${d.label}` : title}
                                label={downloadEntries.length > 1 ? d.label : undefined}
                                relatedTables={d.relatedTables}
                            />
                        ))}

                        {filtersContent && (
                            <Toggle
                                aria-label="Toggle filters"
                                size="stacked"
                                className="flex flex-col items-center px-3 py-2 min-w-[80px] basis-[calc((100%-1rem)/3)] grow-0 gap-1"
                                pressed={filtersOpen}
                                onPressedChange={setFiltersOpen}
                            >
                                <SlidersHorizontal className="h-5 w-5" />
                                <span className='text-xs'>Filters</span>
                            </Toggle>
                        )}

                        {statsContent && (
                            <Toggle
                                aria-label="Toggle stats"
                                size="stacked"
                                className="flex flex-col items-center px-3 py-2 min-w-[80px] basis-[calc((100%-1rem)/3)] grow-0 gap-1"
                                pressed={statsOpen}
                                onPressedChange={setStatsOpen}
                            >
                                <BarChart3 className="h-5 w-5" />
                                <span className='text-xs'>Stats</span>
                            </Toggle>
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
                    url={url}
                    layerName={layerName}
                    customLegend={customLegend}
                    bivariateLegend={bivariateLegend}
                    arcgisUrl={arcgisUrl}
                    legendUnit={legendUnit}
                    layerLabels={layerLabels}
                />
                {filtersContent && (
                    <div
                        className={`overflow-hidden transition-[max-height] duration-200 ease-out ${filtersOpen ? 'max-h-[1000px]' : 'max-h-0'}`}
                    >
                        <div className="mt-1 mb-2 mx-1 px-1.5 pt-2 border-t border-border/60">
                            {filtersContent}
                        </div>
                    </div>
                )}
                {statsContent && (
                    <div
                        className={`overflow-hidden transition-[max-height] duration-200 ease-out ${statsOpen ? 'max-h-[2000px]' : 'max-h-0'}`}
                    >
                        <div className="mt-1 mb-2 mx-1 px-1.5 pt-2 border-t border-border/60">
                            {statsOpen && statsContent}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LayerControls;