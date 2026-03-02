import { useState, useRef } from 'react'
import { getHazardTextSections, HazardUnit } from '@/routes/_report/-utils/static-hazards-service'
import { MapPreview } from '@/routes/_report/-components/shared/map-preview'
import { ReportLegend, type CustomLegendItem } from '@/routes/_report/-components/content/report-legend'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Info } from 'lucide-react'
import { AnchorLinkIcon } from '@/routes/_report/-components/shared/anchor-link-icon'

const MAP_HEIGHT = 400

interface HazardLayer {
    code: string
    name: string
    url: string
    units: HazardUnit[]
    references: string[]
    customLegendItems?: CustomLegendItem[]
    found: boolean
}

interface ReportLayerSectionProps {
    layer: HazardLayer
    groupName: string
    groupId: string
    polygon: string
}

/** Popover with hover on desktop, tap on mobile */
function InfoPopover({ content }: { content: string }) {
    const [open, setOpen] = useState(false)
    const hoverRef = useRef(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

    const handleMouseEnter = () => {
        clearTimeout(timeoutRef.current)
        hoverRef.current = true
        setOpen(true)
    }

    const handleMouseLeave = () => {
        hoverRef.current = false
        timeoutRef.current = setTimeout(() => {
            if (!hoverRef.current) setOpen(false)
        }, 150)
    }

    return (
        <div className="print:hidden" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-md px-2 py-1 text-xs hover:bg-accent transition-colors shadow-sm">
                        <Info className="h-3 w-3" />
                        How to use map?
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    side="bottom"
                    align="end"
                    collisionPadding={16}
                    className="max-w-md max-h-96 overflow-y-auto bg-secondary text-secondary-foreground border-border"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div
                        className="prose prose-sm max-w-none prose-invert"
                        dangerouslySetInnerHTML={{ __html: content }}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}

export function ReportLayerSection({ layer, groupName, groupId, polygon }: ReportLayerSectionProps) {
    const layerContent = getHazardTextSections(layer.code)
    const mapTitle = `${layer.name} Map`

    // Skip if no content at all
    if (!layerContent.intro && !layerContent.howToUse && !layerContent.moreInfo) {
        return null
    }

    // Info popover with hover+click support
    const tooltip = layerContent.howToUse ? (
        <InfoPopover content={layerContent.howToUse} />
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

            <MapPreview
                polygon={polygon}
                hazardCodes={[layer.code]}
                height={MAP_HEIGHT}
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

            {/* More Information */}
            {layerContent.moreInfo && (
                <div className="space-y-2">
                    <h5 className="font-semibold">More Information</h5>
                    <div className="prose max-w-none text-sm">
                        <div dangerouslySetInnerHTML={{ __html: layerContent.moreInfo }} />
                    </div>
                </div>
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
