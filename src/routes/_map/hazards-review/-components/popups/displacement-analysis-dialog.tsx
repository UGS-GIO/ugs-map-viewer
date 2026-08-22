import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

// The wide "analysis view" — the whole displacement panel expanded into a
// dashboard instead of the narrow sidebar column. Purely a layout shell: the
// caller passes already-rendered slots (filters, KPIs, ranking, charts) so this
// module imports nothing from the stats components (which import it — a cycle).
// KPIs span the top; filters + the basin ranking share the left rail (the
// spatial "where"); the time-series charts take the right (the temporal "how").
// Each region sits in a quiet panel so the dashboard reads as grouped cards
// rather than one dense column. When there are no charts (the Rate surface),
// filters + ranking split the full width.

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

interface DisplacementAnalysisDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    scopeSummary: string
    filtersSlot?: React.ReactNode
    kpisSlot: React.ReactNode
    rankingSlot: React.ReactNode
    chartsSlot?: React.ReactNode
}

export function DisplacementAnalysisDialog({
    open, onOpenChange, title, scopeSummary, filtersSlot, kpisSlot, rankingSlot, chartsSlot,
}: DisplacementAnalysisDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
                    <DialogDescription>{scopeSummary}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-5 pt-2">
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
            </DialogContent>
        </Dialog>
    )
}
