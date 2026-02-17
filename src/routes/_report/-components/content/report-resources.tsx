import { HAZARDS_REPORT_CONTENT } from '@/routes/_report/-data/hazards-content'
import { AnchorLinkIcon } from '@/routes/_report/-components/shared/anchor-link-icon'

export function ReportResources() {
    return (
        <section className="space-y-4 page-break-before">
            <h2 className="group text-3xl font-bold border-b-2 pb-2">
                Other Geological Hazards Resources
                <AnchorLinkIcon sectionId="resources" title="Other Resources" size="md" />
            </h2>
            <div className="prose max-w-none text-sm">
                <div dangerouslySetInnerHTML={{ __html: HAZARDS_REPORT_CONTENT.otherResources }} />
            </div>
        </section>
    )
}