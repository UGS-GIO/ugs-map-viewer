import { HAZARDS_REPORT_CONTENT } from '@/routes/_report/-data/hazards-content'
import { MapPreview } from '@/routes/_report/-components/shared/map-preview'
import { AnchorLinkIcon } from '@/routes/_report/-components/shared/anchor-link-icon'
import { Link } from '@/components/ui/link'

interface ReportCoverProps {
    polygon: string
    quadNames: string[]
}

export function ReportCover({ polygon, quadNames }: ReportCoverProps) {
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
                    <div className="prose max-w-none text-sm">
                        <p dangerouslySetInnerHTML={{ __html: HAZARDS_REPORT_CONTENT.coverPageIntro }} />
                    </div>
                    <MapPreview
                        title={title}
                        polygon={polygon}
                        height={400}
                    />
                    {quadNames.length > 0 && (
                        <p className="text-sm text-foreground">
                            <Link to="https://geology.utah.gov/map-pub/survey-notes/mapping-utahs-geology/" className="font-semibold">USGS 7.5&apos; Quadrangle{quadNames.length > 1 ? 's' : ''}</Link>:{' '}
                            {quadNames.join(', ')}
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground italic leading-relaxed" dangerouslySetInnerHTML={{ __html: HAZARDS_REPORT_CONTENT.disclaimer }} />
                </div>
            </div>
        </section>
    )
}