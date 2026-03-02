import { HazardUnit, getGroupIntroText } from '@/routes/_report/-utils/static-hazards-service'
import { ReportLayerSection } from '@/routes/_report/-components/content/report-layer-section'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { AnchorLinkIcon } from '@/routes/_report/-components/shared/anchor-link-icon'
import { Banner, BannerIcon, BannerTitle } from '@/components/ui/banner'
import { AlertTriangle } from 'lucide-react'

// Function to parse HTML and extract hazard information
function parseHazardIntro(htmlText: string) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlText, 'text/html')

    const paragraphs: string[] = []
    const hazards: { name: string; description: string; codes: string[] }[] = []

    let inHazardSection = false

    doc.body.querySelectorAll('p').forEach(p => {
        const text = p.textContent?.trim() || ''
        const html = p.innerHTML?.trim() || ''

        // Check if this paragraph starts the hazards list
        if (text.match(/hazards include:/i)) {
            inHazardSection = true
            return
        }

        // If we're in the hazard section and find a bold term with a dash
        if (inHazardSection) {
            const strong = p.querySelector('strong')
            if (strong) {
                const hazardName = strong.textContent?.trim() || ''
                const codes = (strong.getAttribute('data-code') || '').split(',').filter(Boolean)
                const fullText = text.replace(/\s+/g, ' ')
                const description = fullText.substring(fullText.indexOf('–') + 1).trim()

                if (hazardName && description) {
                    hazards.push({ name: hazardName, description, codes })
                }
            } else if (text && !text.match(/^&nbsp;$/)) {
                // End of hazards section - remaining text is closing paragraph
                inHazardSection = false
                paragraphs.push(html)
            }
        } else if (text && !text.match(/^&nbsp;$/)) {
            // Regular paragraph before or after hazards
            paragraphs.push(html)
        }
    })

    return { paragraphs, hazards }
}

interface HazardLayer {
    code: string
    name: string
    category: string
    url: string
    units: HazardUnit[]
    references: string[]
    found: boolean
}

interface HazardGroup {
    id: string
    name: string
    layers: HazardLayer[]
}

interface ReportGroupSectionProps {
    group: HazardGroup
    polygon: string
}

export function ReportGroupSection({ group, polygon }: ReportGroupSectionProps) {
    const groupIntroText = getGroupIntroText(group.name) || ''
    const parsed = parseHazardIntro(groupIntroText)

    // Always show all hazard types; track which ones have mapped data
    const layerCodes = new Set(group.layers.filter(l => l.found).map(l => l.code))

    return (
        <section className="space-y-8 page-break-before">
            {/* Group Header */}
            <div className="space-y-4">
                <h2 className="group text-3xl font-bold border-b-2 pb-2">
                    {group.name}
                    <AnchorLinkIcon sectionId={group.id} title={group.name} size="md" />
                </h2>

                {/* Group intro text - Introduction paragraphs */}
                <div className="prose max-w-none text-sm space-y-4">
                    {parsed.paragraphs.slice(0, -1).map((para, idx) => (
                        <p key={idx} dangerouslySetInnerHTML={{ __html: para }} />
                    ))}
                </div>

                {/* Hazards Table */}
                {parsed.hazards.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted">
                                <TableRow>
                                    <TableHead className="text-left p-4 font-semibold w-1/3">Hazard Type</TableHead>
                                    <TableHead className="text-left p-4 font-semibold">Description</TableHead>
                                    <TableHead className="text-left p-4 font-semibold w-24">Mapped</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parsed.hazards.map((hazard, idx) => {
                                    const isMapped = hazard.codes.some(code => layerCodes.has(code))
                                    return (
                                        <TableRow key={idx}>
                                            <TableCell className={`p-4 align-top ${isMapped ? 'font-medium' : 'font-normal text-muted-foreground'}`}>
                                                {hazard.name}
                                            </TableCell>
                                            <TableCell className={`p-4 text-sm ${isMapped ? '' : 'text-muted-foreground'}`}>
                                                {hazard.description}
                                            </TableCell>
                                            <TableCell className="p-4 text-sm text-center">
                                                {isMapped ? '✓' : '—'}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* Closing paragraph */}
                {parsed.paragraphs.length > 0 && (
                    <div className="prose max-w-none text-sm">
                        <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: parsed.paragraphs[parsed.paragraphs.length - 1] }} />
                    </div>
                )}
            </div>

            {/* No mapped data banner */}
            {group.layers.some(l => !l.found) && (
                <Banner className="rounded-lg bg-transparent border border-muted-foreground/30">
                    <BannerIcon className="text-muted-foreground" icon={AlertTriangle} />
                    <BannerTitle className="text-muted-foreground">
                        {group.layers.every(l => !l.found)
                            ? `No ${group.name.toLowerCase()} data has been mapped in this area. The absence of mapped data does not imply the area is free from these hazards.`
                            : `No mapped data in this area for: ${group.layers.filter(l => !l.found).map(l => l.name).join(', ')}. The absence of mapped data does not imply the area is free from these hazards.`
                        }
                    </BannerTitle>
                </Banner>
            )}

            {/* Individual Layer Sections (found layers only) */}
            {group.layers.filter(l => l.found).map(layer => (
                <div
                    key={layer.code}
                    id={`${group.id}-${layer.code.toLowerCase()}`}
                    className="scroll-mt-16 md:scroll-mt-20"
                >
                    <ReportLayerSection
                        layer={layer}
                        groupName={group.name}
                        groupId={group.id}
                        polygon={polygon}
                    />
                </div>
            ))}
        </section>
    )
}