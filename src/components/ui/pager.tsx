import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PagerProps {
    /** 0-indexed current page */
    page: number
    /** Total number of pages */
    totalPages: number
    /** Total item count, used for the "1–10 of 28" range label */
    total: number
    /** Items per page, used to derive the range label */
    pageSize: number
    onPageChange: (page: number) => void
    className?: string
}

/**
 * Compact range + prev/next pager for inline lists. Renders nothing when there
 * is only one page. For full numbered link pagination, use `Pagination` instead.
 */
export function Pager({ page, totalPages, total, pageSize, onPageChange, className }: PagerProps) {
    if (totalPages <= 1) return null
    const safe = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safe * pageSize
    const end = Math.min(start + pageSize, total)

    return (
        <div className={cn('flex items-center justify-between text-xs text-muted-foreground px-1', className)}>
            <span>{start + 1}–{end} of {total}</span>
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={safe === 0}
                    onClick={() => onPageChange(Math.max(0, safe - 1))}
                    aria-label="Previous page"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>{safe + 1}/{totalPages}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={safe >= totalPages - 1}
                    onClick={() => onPageChange(Math.min(totalPages - 1, safe + 1))}
                    aria-label="Next page"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
