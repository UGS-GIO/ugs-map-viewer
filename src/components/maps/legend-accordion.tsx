import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { BivariateLegend } from '@/components/maps/bivariate-legend';
import useLegendPreview from '@/hooks/use-legend-preview';
import { useArcGisLegend } from '@/hooks/use-arcgis-legend';

interface LegendAccordionProps {
    layerId: string;
    url: string;
    isOpen: boolean;
    layerName?: string | null;
    customLegend?: React.ReactNode;
    bivariateLegend?: { xLabel: string; yLabel: string };
    arcgisUrl?: string;
}

const LegendAccordion = ({ layerId, url, isOpen, layerName, customLegend, bivariateLegend, arcgisUrl }: LegendAccordionProps) => {
    const skipFetch = !!customLegend || !!bivariateLegend || !!arcgisUrl;
    const { preview, isLoading, error } = useLegendPreview(layerId, url, layerName ?? undefined, skipFetch);
    const { data: arcgisLegendItems, isLoading: arcgisLoading, error: arcgisError } = useArcGisLegend(arcgisUrl);
    // Use empty string instead of undefined to keep accordion controlled
    const accordionValue = isOpen ? "legend-accordion" : "";

    const renderContent = () => {
        if (bivariateLegend && url && layerName) {
            return (
                <BivariateLegend
                    wmsUrl={url}
                    layerName={layerName}
                    xLabel={bivariateLegend.xLabel}
                    yLabel={bivariateLegend.yLabel}
                />
            );
        }

        if (customLegend) return customLegend;

        if (arcgisUrl) {
            return (
                <>
                    {arcgisLoading && <div>Loading legend...</div>}
                    {arcgisError && <div>Error loading legend: {arcgisError.message}</div>}
                    {arcgisLegendItems?.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2 py-1">
                            <img
                                src={`data:${item.contentType};base64,${item.imageData}`}
                                width={item.width}
                                height={item.height}
                                alt={item.label}
                                className="min-w-5"
                            />
                            <span className="text-sm">{item.label}</span>
                        </div>
                    ))}
                </>
            );
        }

        return (
            <>
                {isLoading && <div>Loading legend...</div>}
                {error && <div>Error loading legend: {error.message}</div>}
                {preview?.map((previewItem, index) => (
                    <div key={index} className="flex items-center space-x-2 py-1">
                        {previewItem?.html &&
                            <span
                                className="flex items-center justify-center w-8 min-w-8"
                                aria-hidden="true"
                                dangerouslySetInnerHTML={{ __html: previewItem?.html?.outerHTML || '' }}
                            />
                        }
                        <span>{previewItem?.label}</span>
                    </div>
                ))}
            </>
        );
    };

    return (
        <Accordion
            type='single'
            collapsible
            value={accordionValue}
        >
            <AccordionItem value="legend-accordion">
                <AccordionContent>
                    <div className='py-2 px-2'>
                        {renderContent()}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

export { LegendAccordion };
