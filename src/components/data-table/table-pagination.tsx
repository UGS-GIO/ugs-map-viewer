import type { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ChevronFirst,
    ChevronLast,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface TablePaginationProps<T> {
    table: Table<T>;
    totalRows: number;
}

export function TablePagination<T>({ table, totalRows }: TablePaginationProps<T>) {
    const filteredCount = table.getFilteredRowModel().rows.length;

    return (
        <div className="flex items-center justify-between gap-2 py-2 pl-4 pr-2 border-t shrink-0">
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">Rows</span>
                <Select
                    value={String(table.getState().pagination.pageSize)}
                    onValueChange={(value) => table.setPageSize(Number(value))}
                >
                    <SelectTrigger className="h-7 w-16">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                                {size}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {filteredCount < totalRows && (
                    <span className="text-xs text-muted-foreground">
                        {filteredCount} of {totalRows}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">
                    {table.getState().pagination.pageIndex + 1}/{table.getPageCount() || 1}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 hidden sm:flex"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                >
                    <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 hidden sm:flex"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                >
                    <ChevronLast className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
