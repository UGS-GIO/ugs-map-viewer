import { useMemo } from 'react';
import {
    type ColumnDef,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    ChevronRight,
    ChevronDown,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from 'lucide-react';
import type { ColumnConfig, RowData } from './types';
import type { RelatedTable } from '@/lib/types/mapping-types';
import { formatFieldValue } from '@/lib/field-formatting';

export function useTableColumns(
    columnConfigs: ColumnConfig[],
    relatedTables?: RelatedTable[],
): ColumnDef<RowData>[] {
    return useMemo((): ColumnDef<RowData>[] => {
        const cols: ColumnDef<RowData>[] = [
            {
                id: 'select',
                header: ({ table }) => (
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected()}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all"
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                    />
                ),
                enableSorting: false,
                enableHiding: false,
                enableResizing: false,
                size: 28,
            },
        ];

        // Custom fields are unsortable by default — their accessorFn returns raw property
        // values but the cell renders via transform(properties), so sort order wouldn't
        // match what the user sees.
        for (const config of columnConfigs) {
            const isNumeric = config.fieldConfig?.type === 'number';
            const isCustom = config.fieldConfig?.type === 'custom';
            const isSortable = config.fieldConfig?.sortable ?? !isCustom;
            cols.push({
                id: config.id,
                meta: { columnConfig: config },
                accessorFn: (row) => {
                    const val = row.properties[config.field];
                    if (isNumeric) {
                        const num = Number(val);
                        return Number.isFinite(num) ? num : undefined;
                    }
                    return val;
                },
                header: ({ column }) => {
                    const label = column.columnDef.meta?.columnConfig?.label ?? column.id;
                    if (!column.getCanSort()) {
                        return <span className="px-2 text-sm font-medium">{label}</span>;
                    }
                    return (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                        >
                            {label}
                            {column.getIsSorted() === 'asc' ? (
                                <ArrowUp className="ml-1 h-3 w-3" />
                            ) : column.getIsSorted() === 'desc' ? (
                                <ArrowDown className="ml-1 h-3 w-3" />
                            ) : (
                                <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                            )}
                        </Button>
                    );
                },
                cell: ({ row, getValue, column }) => {
                    const rawValue = getValue();
                    const fieldConfig = column.columnDef.meta?.columnConfig?.fieldConfig;
                    const formatted = formatFieldValue(fieldConfig, rawValue, row.original.properties);
                    return formatted || '-';
                },
                enableSorting: isSortable,
                sortingFn: isNumeric ? 'basic' : 'alphanumeric',
                sortUndefined: 'last',
                filterFn: 'includesString',
            });
        }

        // Related table cells access data via table.options.meta so these deps
        // don't cause column recreation on every data fetch.
        if (relatedTables) {
            relatedTables.forEach((relatedTable, tableIndex) => {
                const label = relatedTable.fieldLabel || 'Description';

                cols.push({
                    id: `related-${tableIndex}`,
                    header: label || 'Related',
                    cell: ({ row, table }) => {
                        const meta = table.options.meta!;
                        const targetValue = String(row.original.properties[relatedTable.targetField] ?? '');
                        if (!targetValue) return '-';
                        const currentMap = meta.relatedDataMaps[tableIndex];
                        if (!currentMap || currentMap.size === 0) {
                            return meta.relatedLoading ? 'Loading...' : '-';
                        }

                        const rows = currentMap.get(targetValue);
                        if (!rows || rows.length === 0) return '-';

                        const isExpanded = meta.expandedTables[row.id] === tableIndex;
                        return (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    meta.setExpandedTables(prev => ({
                                        ...prev,
                                        [row.id]: prev[row.id] === tableIndex ? null : tableIndex
                                    }));
                                }}
                            >
                                {isExpanded ? (
                                    <ChevronDown className="h-3 w-3 mr-1" />
                                ) : (
                                    <ChevronRight className="h-3 w-3 mr-1" />
                                )}
                                {rows.length} {rows.length === 1 ? 'record' : 'records'}
                            </Button>
                        );
                    },
                    enableSorting: false,
                    size: 120,
                });
            });
        }

        return cols;
    }, [columnConfigs, relatedTables]);
}
