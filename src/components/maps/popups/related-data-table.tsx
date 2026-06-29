import { useMemo, useState, type ReactNode } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumeric } from '@/lib/utils';
import type { DisplayField } from '@/lib/types/mapping-types';

type Row = Record<string, unknown>;

/**
 * Sort key derived from a RAW field value. Numeric values (incl. thousands
 * separators / currency) → number; `N/A`/blank/null → undefined (pinned last via
 * `sortUndefined`); everything else → string. Sorting on the raw value (not the
 * rendered cell) keeps numeric order honest and N/A out of the middle.
 */
function sortKey(raw: unknown): number | string | undefined {
    if (raw == null) return undefined;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
    const s = String(raw).trim();
    if (s === '' || /^n\/?a$/i.test(s)) return undefined;
    const stripped = s.replace(/[$,\s]/g, '');
    if (/^[-+]?\d*\.?\d+$/.test(stripped)) {
        const n = Number(stripped);
        if (Number.isFinite(n)) return n;
    }
    return s;
}

/** Render a cell the way the popup does: format → transform → `N/A` fallback. */
function renderCell(df: DisplayField, row: Row, allRows: Row[]): ReactNode {
    const formatted = formatNumeric(row[df.field], df.format);
    const final = df.transform ? df.transform(formatted, row, allRows) : formatted;
    return final || 'N/A';
}

/**
 * Sortable related-table (TanStack Table over raw rows). Each `displayField`
 * becomes a column: sorting uses the raw value (numeric or alphabetical, N/A
 * last); the cell renders via the field's format + transform. Columns whose
 * cells are React nodes (links, photo galleries) are not sortable.
 */
export function RelatedDataTable({
    rows,
    displayFields,
    initialSort,
}: {
    rows: Row[];
    displayFields: DisplayField[];
    /** Default sort (from the related-table config's sortBy/sortDirection). */
    initialSort?: { id: string; desc: boolean };
}) {
    const [sorting, setSorting] = useState<SortingState>(initialSort ? [initialSort] : []);

    // Pre-render cells once: drives both display and which columns are sortable
    // (a column with any React-node cell can't be meaningfully sorted).
    const rendered = useMemo(
        () => rows.map(row => displayFields.map(df => renderCell(df, row, rows))),
        [rows, displayFields],
    );
    const sortableCols = useMemo(
        () => displayFields.map((_, ci) => rendered.every(r => {
            const c = r[ci];
            return c == null || typeof c === 'string' || typeof c === 'number';
        })),
        [rendered, displayFields],
    );

    const columns = useMemo<ColumnDef<Row>[]>(
        () => displayFields.map((df, ci) => ({
            id: df.field,
            accessorFn: (row) => sortKey(row[df.field]),
            header: df.label || df.field,
            cell: ({ row }) => rendered[row.index][ci],
            enableSorting: sortableCols[ci],
            sortUndefined: 'last',
            sortDescFirst: false, // first click = ascending for every column (TanStack defaults numbers to desc-first)
            sortingFn: (a, b, id) => {
                const va = a.getValue(id), vb = b.getValue(id);
                if (typeof va === 'number' && typeof vb === 'number') return va - vb;
                return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
            },
        })),
        [displayFields, rendered, sortableCols],
    );

    const table = useReactTable({
        data: rows,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <Table>
            <TableHeader>
                {table.getHeaderGroups().map(hg => (
                    <TableRow key={hg.id}>
                        {hg.headers.map(header => {
                            const sorted = header.column.getIsSorted();
                            return (
                                <TableHead key={header.id} className="h-8 text-xs">
                                    {header.column.getCanSort() ? (
                                        <button
                                            type="button"
                                            onClick={header.column.getToggleSortingHandler()}
                                            className="flex items-center gap-1 hover:text-foreground"
                                        >
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {sorted === 'asc' && <ChevronUp className="h-3 w-3" />}
                                            {sorted === 'desc' && <ChevronDown className="h-3 w-3" />}
                                            {!sorted && <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                                        </button>
                                    ) : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                            );
                        })}
                    </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {table.getRowModel().rows.map(row => (
                    <TableRow key={row.id}>
                        {row.getVisibleCells().map(cell => (
                            <TableCell key={cell.id} className="py-1.5 text-xs">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
