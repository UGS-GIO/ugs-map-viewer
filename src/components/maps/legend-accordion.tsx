import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { BivariateLegend } from '@/components/maps/bivariate-legend';
import useLegendPreview, { type PreviewItem } from '@/hooks/use-legend-preview';
import { useArcGisLegend } from '@/hooks/use-arcgis-legend';

interface LegendAccordionProps {
    url: string;
    isOpen: boolean;
    layerName?: string | null;
    customLegend?: React.ReactNode;
    bivariateLegend?: { xLabel: string; yLabel: string };
    arcgisUrl?: string;
    legendUnit?: string;
}

/** Callback ref that mounts a DOM node as the host's only child. Avoids dangerouslySetInnerHTML. */
function mountDomNode(node: Node) {
    return (host: HTMLElement | null) => {
        if (host) host.replaceChildren(node.cloneNode(true));
    };
}

function LegendItem({ item }: { item: PreviewItem }) {
    const html = item.html;
    if (!html) return null;

    // Symbolizers can opt into a full-width layout via `data-fullwidth="true"`.
    if (html.dataset?.fullwidth === 'true') {
        return <span className="block px-0.5 py-1" ref={mountDomNode(html)} />;
    }

    return (
        <div className="flex items-center space-x-2 py-1">
            <span
                className="flex items-center justify-center w-8 min-w-8"
                aria-hidden
                ref={mountDomNode(html)}
            />
            <span>{item.label}</span>
        </div>
    );
}

const LegendAccordion = ({ url, isOpen, layerName, customLegend, bivariateLegend, arcgisUrl, legendUnit }: LegendAccordionProps) => {
    const skipFetch = !!customLegend || !!bivariateLegend || !!arcgisUrl;
    const { preview, isLoading, error } = useLegendPreview(url, layerName ?? undefined, skipFetch, legendUnit);
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

        if (isLoading) return <div>Loading legend...</div>;
        if (error) return <div>Error loading legend: {error.message}</div>;

        return <>{preview?.map((item, i) => <LegendItem key={i} item={item} />)}</>;
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
