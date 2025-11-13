import { getHazardTextSections } from '@/routes/_report/-utils/static-hazards-service'
import { ReportScreenshot } from '@/routes/_report/-components/shared/report-screenshot'
import { ReportLegend, type CustomLegendItem } from '@/routes/_report/-components/content/report-legend'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { HazardUnit } from '@/routes/_report/-utils/static-hazards-service'
import { AnchorLinkIcon } from '@/routes/_report/-components/shared/anchor-link-icon'

interface HazardLayer {
    code: string
    name: string
    url: string
    units: HazardUnit[]
    references: string[]
    customLegendItems?: CustomLegendItem[]
}

interface ReportLayerSectionProps {
    layer: HazardLayer
    groupName: string
    groupId: string
    polygon: string
}

export function ReportLayerSection({ layer, groupName, groupId, polygon }: ReportLayerSectionProps) {
    const layerContent = getHazardTextSections(layer.code)
    const mapTitle = `${layer.name} Map`

    // Skip if no content at all
    if (!layerContent.intro && !layerContent.howToUse && !layerContent.moreInfo) {
        return null
    }

    // Tooltip component
    const tooltip = layerContent.howToUse ? (
        <div className="print:hidden">
            <TooltipProvider>
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <button className="flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-md px-2 py-1 text-xs hover:bg-accent transition-colors shadow-sm">
                            <Info className="h-3 w-3" />
                            How to use map?
                        </button>
                    </TooltipTrigger>
                    <TooltipContent
                        side="left"
                        className="max-w-md max-h-96 overflow-y-auto bg-secondary text-secondary-foreground border-border"
                    >
                        <div
                            className="prose prose-sm max-w-none prose-invert"
                            dangerouslySetInnerHTML={{ __html: layerContent.howToUse }}
                        />
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    ) : undefined

    return (
        <div className="space-y-6 pt-8 border-t">
            <div>
                <h3 className="text-2xl font-bold">{groupName}</h3>
                <h4 className="group text-xl font-semibold text-muted-foreground w-fit">
                    {layer.name}
                    <AnchorLinkIcon sectionId={`${groupId}-${layer.code.toLowerCase()}`} title={layer.name} size="sm" />
                </h4>
            </div>

            {/* Intro text */}
            {layerContent.intro && (
                <div className="prose max-w-none text-sm">
                    <div dangerouslySetInnerHTML={{ __html: layerContent.intro }} />
                </div>
            )}

            {/* Map with title and tooltip */}
            <ReportScreenshot
                polygon={polygon}
                hazardCodes={[layer.code]}
                height={400}
                title={mapTitle}
                tooltip={tooltip}
            />

            {/* How to Use (Print Only) */}
            {layerContent.howToUse && (
                <div className="hidden print:block space-y-2">
                    <h5 className="font-semibold">How to Use This Map</h5>
                    <div className="prose max-w-none text-sm">
                        <div dangerouslySetInnerHTML={{ __html: layerContent.howToUse }} />
                    </div>
                </div>
            )}

            {/* Legend */}
            {layer.customLegendItems ? (
                <ReportLegend
                    customItems={layer.customLegendItems}
                    layerName={layer.name}
                />
            ) : (
                <ReportLegend
                    layers={[{
                        id: layer.code,
                        name: layer.name,
                        url: layer.url
                    }]}
                    showUnitDescriptions={true}
                    units={layer.units}
                />
            )}

            {/* References */}
            {layer.references.length > 0 && (
                <div className="space-y-2">
                    <h5 className="font-semibold">References</h5>
                    <div className="prose max-w-none text-sm space-y-2">
                        {layer.references.map((ref, idx) => (
                            <div key={idx} dangerouslySetInnerHTML={{ __html: ref }} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}