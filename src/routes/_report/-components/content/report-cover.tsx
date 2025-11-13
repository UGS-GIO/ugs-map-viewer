import { HAZARDS_REPORT_CONTENT } from '@/routes/_report/-data/hazards-content'
import { ReportScreenshot } from '@/routes/_report/-components/shared/report-screenshot'
import { AnchorLinkIcon } from '@/routes/_report/-components/shared/anchor-link-icon'

interface ReportCoverProps {
    polygon: string
}

export function ReportCover({ polygon }: ReportCoverProps) {
    const title = 'Area of Interest Overview Map'
    return (
        <section className="space-y-12">
            {/* Cover Content */}
            <div className="flex flex-col justify-start space-y-12">
                <div className="space-y-6">
                    <h2 className="group text-3xl font-bold border-b-2 pb-2 hidden">
                        Cover
                        <AnchorLinkIcon sectionId="cover" title="Cover" size="md" />
                    </h2>
                    <p className="text-sm leading-relaxed">{HAZARDS_REPORT_CONTENT.coverPageIntro}</p>
                    <ReportScreenshot
                        title={title}
                        polygon={polygon}
                        height={400}
                    />
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                        {HAZARDS_REPORT_CONTENT.disclaimer}
                    </p>
                </div>
            </div>
        </section>
    )
}