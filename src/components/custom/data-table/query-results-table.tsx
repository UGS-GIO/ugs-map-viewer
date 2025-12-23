import { useMemo, useState, useCallback } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Shrink,
    X,
    Table2,
} from 'lucide-react';
import type { LayerContentProps, ExtendedFeature } from '@/components/custom/popups/popup-content-with-pagination';
import { useMap } from '@/hooks/use-map';
import { zoomToFeature } from '@/lib/map/utils';
import { highlightFeature, clearGraphics } from '@/lib/map/highlight-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface QueryResultsTableProps {
    layerContent: LayerContentProps[];
    onClose?: () => void;
}

interface FlattenedRow {
    id: string;
    layerTitle: string;
    sourceCRS: string;
    feature: ExtendedFeature;
    properties: Record<string, unknown>;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function QueryResultsTable({ layerContent, onClose }: QueryResultsTableProps) {
    const { map } = useMap();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

    // Flatten all features from all layers into rows
    const flattenedData = useMemo((): FlattenedRow[] => {
        const rows: FlattenedRow[] = [];
        for (const layer of layerContent) {
            if (!layer.features) continue;
            for (let i = 0; i < layer.features.length; i++) {
                const feature = layer.features[i];
                rows.push({
                    id: `${layer.layerTitle}-${feature.id || i}`,
                    layerTitle: layer.layerTitle || layer.groupLayerTitle,
                    sourceCRS: layer.sourceCRS,
                    feature,
                    properties: feature.properties || {},
                });
            }
        }
        return rows;
    }, [layerContent]);

    // Get all unique property keys for columns
    const propertyKeys = useMemo(() => {
        const keys = new Set<string>();
        for (const row of flattenedData) {
            Object.keys(row.properties).forEach(key => {
                // Skip geometry and internal fields
                if (!['shape', 'geom', 'geometry', 'bbox'].includes(key.toLowerCase())) {
                    keys.add(key);
                }
            });
        }
        return Array.from(keys);
    }, [flattenedData]);

    // Handle row click - zoom and highlight
    const handleRowClick = useCallback((row: FlattenedRow) => {
        if (!map) return;

        setSelectedRowId(row.id);

        // Clear previous highlights and add new one
        clearGraphics(map, row.layerTitle);
        highlightFeature(row.feature, map, row.sourceCRS, row.layerTitle);

        // Zoom to feature
        zoomToFeature(row.feature, map, row.sourceCRS);
    }, [map]);

    // Build columns dynamically
    const columns = useMemo((): ColumnDef<FlattenedRow>[] => {
        const cols: ColumnDef<FlattenedRow>[] = [
            {
                id: 'actions',
                header: '',
                size: 40,
                cell: ({ row }) => (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(row.original);
                        }}
                        title="Zoom to feature"
                    >
                        <Shrink className="h-3 w-3" />
                    </Button>
                ),
            },
            {
                accessorKey: 'layerTitle',
                header: 'Layer',
                size: 120,
            },
        ];

        // Add property columns (limit to first 10 for performance)
        const displayKeys = propertyKeys.slice(0, 10);
        for (const key of displayKeys) {
            cols.push({
                id: key,
                accessorFn: (row) => row.properties[key],
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    >
                        {key}
                        {column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="ml-1 h-3 w-3" />
                        ) : column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="ml-1 h-3 w-3" />
                        ) : (
                            <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                        )}
                    </Button>
                ),
                cell: ({ getValue }) => {
                    const value = getValue();
                    if (value === null || value === undefined) return '-';
                    if (typeof value === 'object') return JSON.stringify(value);
                    return String(value);
                },
            });
        }

        return cols;
    }, [propertyKeys, handleRowClick]);

    const table = useReactTable({
        data: flattenedData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            globalFilter,
        },
        initialState: {
            pagination: {
                pageSize: 25,
            },
        },
    });

    if (flattenedData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground gap-2">
                <Table2 className="h-8 w-8 opacity-50" />
                <p className="text-sm">Click on the map to query features</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header with search and close */}
            <div className="flex items-center justify-between gap-2 py-2 pl-4 pr-2 border-b shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium whitespace-nowrap">
                        {flattenedData.length} feature{flattenedData.length !== 1 ? 's' : ''}
                    </span>
                    <Input
                        placeholder="Search..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="h-8 w-48"
                    />
                </div>
                {onClose && (
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Table */}
            <ScrollArea className="flex-1 min-h-0">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header, index) => (
                                    <TableHead
                                        key={header.id}
                                        style={{ width: header.getSize() }}
                                        className={cn("whitespace-nowrap", index === 0 && "pl-4")}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    onClick={() => handleRowClick(row.original)}
                                    className={`cursor-pointer hover:bg-muted/50 ${
                                        selectedRowId === row.original.id ? 'bg-primary/10' : ''
                                    }`}
                                >
                                    {row.getVisibleCells().map((cell, index) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn("py-1.5", index === 0 && "pl-4")}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results found
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-2 py-2 pl-4 pr-2 border-t shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select
                        value={String(table.getState().pagination.pageSize)}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                    >
                        <SelectTrigger className="h-8 w-16">
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
                </div>

                <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronFirst className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronLast className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
