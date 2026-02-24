import { Info, Shrink, TableOfContents } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { LegendAccordion } from '@/components/maps/legend-accordion';
import { useEffect, useRef, useState } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { LayerDescriptionAccordion } from '@/components/maps/layer-description-accordion';

interface LayerControlsProps {
    handleZoomToLayer: () => void;
    layerOpacity: number | null;
    handleOpacityChange: (e: number) => void;
    handleOpacityCommit: (e: number) => void;
    title: string;
    description: string;
    layerId: string;
    url: string;
    openLegend?: boolean;
    layerName?: string | null;
    customLegend?: React.ReactNode;
    bivariateLegend?: { xLabel: string; yLabel: string };
}

const LayerControls: React.FC<LayerControlsProps> = ({
    handleZoomToLayer,
    layerOpacity,
    handleOpacityChange,
    handleOpacityCommit,
    description,
    title,
    layerId,
    url,
    openLegend,
    layerName,
    customLegend,
    bivariateLegend,
}) => {
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);
    const [cleanDescription, setCleanDescription] = useState<string>('');
    const lastOpacityRef = useRef(layerOpacity ?? 1);
    const [dragValue, setDragValue] = useState<number | null>(null);

    if (layerOpacity !== null) {
        lastOpacityRef.current = layerOpacity;
    }

    useEffect(() => {
        if (openLegend) {
            setOpenAccordion('legend');
        }
    }, [openLegend]);

    // Lazy load DOMPurify only when description is needed
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

    return (
        <div className="flex flex-col gap-y-4 pt-2">
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
                                    setDragValue(e[0])
                                    handleOpacityChange(e[0])
                                }}
                                onValueCommit={(e) => {
                                    setDragValue(e[0])
                                    handleOpacityCommit(e[0])
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
                            data-tour="layer-legend"
                        >
                            <TableOfContents className="h-5 w-5" />
                            <span className='text-xs'>Legend</span>
                        </Toggle>
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
                    customLegend={customLegend}
                    bivariateLegend={bivariateLegend}
                />
            </div>
        </div>
    );
};

export default LayerControls;