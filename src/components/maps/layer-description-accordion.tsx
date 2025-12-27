import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';

interface LayerDescriptionAccordionProps {
    description: string;
    isOpen: boolean;
}

const LayerDescriptionAccordion = ({ description, isOpen }: LayerDescriptionAccordionProps) => {
    // Use empty string instead of undefined to keep accordion controlled
    const accordionValue = isOpen ? "layer-description-accordion" : "";

    return (
        <Accordion
            type='single'
            collapsible
            value={accordionValue}
        >
            <AccordionItem value="layer-description-accordion">
                <AccordionContent>
                    <div
                        className="custom-tooltip pt-4 px-4"
                        dangerouslySetInnerHTML={{ __html: description }}
                    />
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

export { LayerDescriptionAccordion };