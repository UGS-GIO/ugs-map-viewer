import { Info, Shrink, TableOfContents } from 'lucide-react';
import { Button } from '@/components/custom/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { LegendAccordion } from '@/components/custom/legend-accordion';
import { useEffect, useState } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { LayerDescriptionAccordion } from '@/components/custom/layer-description-accordion';

interface LayerControlsProps {
    handleZoomToLayer: () => void;
    layerOpacity: number;
    handleOpacityChange: (e: number) => void;
    title: string;
    description: string;
    layerId: string;
    url: string;
    openLegend?: boolean;
}

const LayerControls: React.FC<LayerControlsProps> = ({
    handleZoomToLayer,
    layerOpacity,
    handleOpacityChange,
    description,
    title,
    layerId,
    url,
    openLegend,
}) => {
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);
    const [cleanDescription, setCleanDescription] = useState<string>('');

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
                    <div className="flex flex-row items-center justify-around gap-x-2 w-full mx-auto">
                        <Label htmlFor={`${title}-opacity`}>
                            Opacity
                        </Label>
                        <Slider
                            className="flex-grow"
                            defaultValue={[layerOpacity * 100]}
                            onValueChange={(e) => handleOpacityChange(e[0])}
                        />
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
                />
            </div>
        </div>
    );
};

export default LayerControls;