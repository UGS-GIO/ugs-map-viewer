import { HAZARDS_REPORT_CONTENT } from '@/routes/_report/-data/hazards-content'
import { HazardUnit } from '@/routes/_report/-utils/static-hazards-service'
import { AnchorLinkIcon } from '@/routes/_report/-components/shared/anchor-link-icon'

interface HazardGroup {
    id: string
    name: string
    layers: Array<{
        code: string
        name: string
        units: HazardUnit[]
    }>
}

interface ReportSummaryProps {
    hazardGroups: HazardGroup[]
}

export function ReportSummary({ hazardGroups }: ReportSummaryProps) {
    return (
        <section className="space-y-8">
            <h2 className="group text-3xl font-bold border-b-2 pb-2">
                Report Summary
                <AnchorLinkIcon sectionId="summary" title="Report Summary" size="md" />
            </h2>

            <div className="space-y-4">
                <div className="prose max-w-none text-sm">
                    <p dangerouslySetInnerHTML={{ __html: HAZARDS_REPORT_CONTENT.summary.intro }} />
                </div>

                <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Mapped Geologic Hazards</h3>
                    <div className="space-y-4">
                        {hazardGroups.map(group => (
                            <div key={group.id} className="border-b last:border-b-0 pb-3">
                                {/* Hazard Group Name (Category) */}
                                <h4 className="text-base font-semibold text-primary mb-2">
                                    {group.name}
                                </h4>

                                {/* List of Mapped Geologic Hazards within the category */}
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    {Array.from(
                                        new Set(
                                            group.layers.map(layer => layer.name)
                                        )
                                    ).map(layerName => (
                                        <li key={layerName}>
                                            {layerName}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="prose max-w-none text-sm">
                <p dangerouslySetInnerHTML={{ __html: HAZARDS_REPORT_CONTENT.summary.closing }} />
            </div>
        </section>
    )
}