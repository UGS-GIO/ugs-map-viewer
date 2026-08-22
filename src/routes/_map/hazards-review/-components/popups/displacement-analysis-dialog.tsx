import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

// The wide "analysis view" — the whole displacement panel expanded into a
// dashboard instead of the narrow sidebar column. Purely a layout shell: the
// caller passes already-rendered slots (filters, KPIs, ranking, charts) so this
// module imports nothing from the stats components (which import it — a cycle).
// KPIs span the top; filters + the basin ranking share the left rail (the
// spatial "where"); the time-series charts take the right (the temporal "how").
// When there are no charts (the Rate surface), filters + ranking go full width.

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
            <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{scopeSummary}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 pt-1">
                    {kpisSlot}
                    {chartsSlot ? (
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(260px,320px)_1fr]">
                            <div className="flex flex-col gap-4">
                                {filtersSlot}
                                {rankingSlot}
                            </div>
                            <div className="min-w-0">{chartsSlot}</div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {filtersSlot}
                            {rankingSlot}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
