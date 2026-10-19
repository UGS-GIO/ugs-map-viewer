// Inner layout for the wide "analysis view" — the whole displacement panel laid
// out as a dashboard instead of the narrow sidebar column. Purely presentational:
// the caller passes already-rendered slots (scope summary, filters, KPIs, ranking,
// charts) so this module imports nothing from the stats components (which import
// it — a cycle). The Dialog wrapper + surface switcher live in the host
// (displacement-analysis-host.tsx), above the sidebar's surface-switch remount, so
// the pop-out survives switching surfaces; this layout just fills the body.
//
// KPIs span the top; filters + the basin ranking share the left rail (the spatial
// "where"); the time-series charts take the right (the temporal "how"). Each region
// sits in a quiet panel so the dashboard reads as grouped cards rather than one
// dense column. When there are no charts (the Rate surface), filters + ranking split
// the full width.

function Panel({ label, children }: { label?: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-border/60 bg-muted/20 p-4">
            {label && (
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
            )}
            {children}
        </section>
    )
}

interface DisplacementAnalysisLayoutProps {
    scopeSummary: string
    filtersSlot?: React.ReactNode
    kpisSlot: React.ReactNode
    rankingSlot: React.ReactNode
    chartsSlot?: React.ReactNode
}

export function DisplacementAnalysisLayout({
    scopeSummary, filtersSlot, kpisSlot, rankingSlot, chartsSlot,
}: DisplacementAnalysisLayoutProps) {
    return (
        <div className="flex flex-col gap-5 pt-1">
            <p className="-mt-2 text-sm text-muted-foreground">{scopeSummary}</p>
            {kpisSlot}
            {chartsSlot ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
                    <div className="flex flex-col gap-4">
                        <Panel label="Filters">{filtersSlot}</Panel>
                        <Panel>{rankingSlot}</Panel>
                    </div>
                    <Panel>
                        <div className="min-w-0">{chartsSlot}</div>
                    </Panel>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Panel label="Filters">{filtersSlot}</Panel>
                    <Panel>{rankingSlot}</Panel>
                </div>
            )}
        </div>
    )
}
