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

// Function to parse HTML and extract hazard information
function parseHazardIntro(htmlText: string) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlText, 'text/html')

    const paragraphs: string[] = []
    const hazards: { name: string; description: string }[] = []

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
                const fullText = text.replace(/\s+/g, ' ')
                const description = fullText.substring(fullText.indexOf('–') + 1).trim()

                if (hazardName && description) {
                    hazards.push({ name: hazardName, description })
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
}

interface HazardGroup {
    id: string
    name: string
    layers: HazardLayer[]
}

/**
 * Check if a parsed hazard type name from the group intro text matches any
 * layer that actually intersects the report area. Uses word-overlap matching
 * since the text names differ slightly from the layer names
 * (e.g., "Liquefaction" vs "Liquefaction Susceptibility").
 */
function hazardMatchesAnyLayer(hazardName: string, layers: HazardLayer[]): boolean {
    const stopWords = new Set(['and', 'the', 'or', 'of', 'in', 'for', 'to'])
    const hazardWords = hazardName.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
        .filter(w => w.length >= 4 && !stopWords.has(w))

    return layers.some(layer => {
        const nameWords = new Set(
            layer.name.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
        )
        return hazardWords.some(word => nameWords.has(word))
    })
}

interface ReportGroupSectionProps {
    group: HazardGroup
    polygon: string
    showAllHazardTypes?: boolean
}

export function ReportGroupSection({ group, polygon, showAllHazardTypes = false }: ReportGroupSectionProps) {
    const groupIntroText = getGroupIntroText(group.name) || ''
    const parsed = parseHazardIntro(groupIntroText)

    // Filter hazard types table to only those that intersect the report area
    const filteredHazards = showAllHazardTypes
        ? parsed.hazards
        : parsed.hazards.filter(h => hazardMatchesAnyLayer(h.name, group.layers))

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
                {filteredHazards.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted">
                                <TableRow>
                                    <TableHead className="text-left p-4 font-semibold w-1/3">Hazard Type</TableHead>
                                    <TableHead className="text-left p-4 font-semibold">Description</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredHazards.map((hazard, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="p-4 font-medium align-top">{hazard.name}</TableCell>
                                        <TableCell className="p-4 text-sm">{hazard.description}</TableCell>
                                    </TableRow>
                                ))}
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

            {/* Individual Layer Sections */}
            {group.layers.map(layer => (
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