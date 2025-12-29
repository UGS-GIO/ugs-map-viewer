import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import useLegendPreview from '@/hooks/use-legend-preview';

interface LegendAccordionProps {
    layerId: string;
    url: string;
    isOpen: boolean;
    layerName?: string | null;
}

const LegendAccordion = ({ layerId, url, isOpen, layerName }: LegendAccordionProps) => {
    const { preview, isLoading, error } = useLegendPreview(layerId, url, layerName ?? undefined);
    // Use empty string instead of undefined to keep accordion controlled
    const accordionValue = isOpen ? "legend-accordion" : "";

    return (
        // 3. CLEAN UP JSX: The hidden trigger button is removed.
        <Accordion
            type='single'
            collapsible
            value={accordionValue}
        >
            <AccordionItem value="legend-accordion">
                <AccordionContent>
                    <div className='pt-4 px-4'>
                        {isLoading && <div>Loading legend...</div>}
                        {error && <div>Error loading legend: {error.message}</div>}
                        {preview?.map((previewItem, index) => (
                            <div key={index} className="flex items-center space-x-2 py-1">
                                {previewItem?.html &&
                                    <span
                                        className="flex items-center justify-center w-8 min-w-8"
                                        dangerouslySetInnerHTML={{ __html: previewItem?.html?.outerHTML || '' }}
                                    />
                                }
                                <span>{previewItem?.label}</span>
                            </div>
                        ))}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

export { LegendAccordion };