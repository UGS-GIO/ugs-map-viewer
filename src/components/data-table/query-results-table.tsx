import { useMemo, useState, useCallback, useRef, useEffect, Fragment } from 'react';
import { useDebounce } from 'use-debounce';
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type VisibilityState,
    type RowSelectionState,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    X,
    Table2,
    Download,
    Columns3,
    MapPin,
    Map,
    SplitSquareVertical,
} from 'lucide-react';
import { hasRasterData, type LayerContentProps } from '@/components/maps/popups/types';
import type { ViewMode } from './types';
import type { SelectedFeatureRef } from '@/hooks/use-map-url-sync';
import type { HighlightFeature } from '@/components/maps/types';
import { useZoomToFeature } from '@/hooks/use-zoom-to-feature';
import { cn } from '@/lib/utils';
import { useBulkRelatedTable } from '@/hooks/use-bulk-related-table';
import { exportTableData, type TableExportFormat } from './table-export-utils';
import { EXPORT_FORMATS, GDAL_FORMATS } from '@/lib/export-formats';
import { ExpandedRelatedTable } from './expanded-related-table';
import { useTableColumns } from './use-table-columns';
import { useTableData } from './use-table-data';
import { TablePagination } from './table-pagination';

interface QueryResultsTableProps {
    layerContent: LayerContentProps[];
    onClose?: () => void;
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    selectedFeatureRefs?: SelectedFeatureRef[];
    onSelectedFeaturesChange?: (refs: SelectedFeatureRef[]) => void;
    onHighlightChange?: (features: HighlightFeature[]) => void;
    /** When true, hide the export dropdown. Stakeholder request for apps that require unmodified source data. */
    disableExport?: boolean;
}

const EMPTY_COLUMN_FILTERS: { id: string; value: string }[] = [];


// Labels/hints come from the shared export registry so the table menu and the parquet
// download menu can't drift apart.
const GDAL_TABLE_FORMATS = GDAL_FORMATS.map(format => ({
    format,
    label: EXPORT_FORMATS[format].label,
    hint: EXPORT_FORMATS[format].hint,
}));

export function QueryResultsTable({ layerContent, onClose, viewMode, onViewModeChange, selectedFeatureRefs = [], onSelectedFeaturesChange, onHighlightChange, disableExport = false }: QueryResultsTableProps) {
    const { zoomTo, zoomToAll } = useZoomToFeature({ onHighlightChange });

    const layersWithData = useMemo(() =>
        layerContent.filter(layer =>
            (layer.features && layer.features.length > 0) || hasRasterData(layer)
        ),
        [layerContent]
    );

    const [selectedLayerIndex, setSelectedLayerIndex] = useState(0);
    const [filter, setFilter] = useState({ column: 'all', value: '' });
    const [debouncedFilterValue] = useDebounce(filter.value, 200);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [expandedTables, setExpandedTables] = useState<Record<string, number | null>>({});
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
    const [includeRelatedInExport, setIncludeRelatedInExport] = useState(true);
    const lastClickedRowRef = useRef<number | null>(null);

    // Clamp selectedLayerIndex if layersWithData shrinks
    useEffect(() => {
        if (selectedLayerIndex >= layersWithData.length && layersWithData.length > 0) {
            setSelectedLayerIndex(0);
        }
    }, [selectedLayerIndex, layersWithData.length]);

    const selectedLayer = layersWithData[selectedLayerIndex] || null;
    const { rowData, columnConfigs } = useTableData(selectedLayer);

    const relatedTableTargetValues = useMemo(() => {
        if (!selectedLayer?.relatedTables?.length) return [];
        // Values scoped per table (index-aligned with relatedTables) so each table is queried
        // only with its own key column's values.
        return selectedLayer.relatedTables.map(table =>
            rowData.map(row => String(row.properties[table.targetField!] ?? ''))
        );
    }, [selectedLayer?.relatedTables, rowData]);

    const { dataByTable: relatedDataMaps, isLoading: relatedLoading } = useBulkRelatedTable(
        selectedLayer?.relatedTables,
        relatedTableTargetValues
    );

    // Derive rowSelection from URL's selectedFeatureRefs
    const rowSelection = useMemo((): RowSelectionState => {
        if (selectedFeatureRefs.length === 0) return {};
        const selection: RowSelectionState = {};
        rowData.forEach((row, index) => {
            const featureId = String(row.feature.id ?? index);
            const isSelected = selectedFeatureRefs.some(
                ref => ref.layer === row.layerTitle && ref.id === featureId
            );
            if (isSelected) selection[index] = true;
        });
        return selection;
    }, [selectedFeatureRefs, rowData]);

    const rowIndicesToFeatureRefs = useCallback((indices: number[]): SelectedFeatureRef[] => {
        return indices.map(i => {
            const row = rowData[i];
            if (!row) return null;
            return {
                layer: row.layerTitle,
                id: String(row.feature.id ?? i),
            };
        }).filter((ref): ref is SelectedFeatureRef => ref !== null);
    }, [rowData]);

    // Uses row.id (global index) not page-relative index for proper cross-page selection
    const handleRowClick = useCallback((rowId: string, event: React.MouseEvent) => {
        if ((event.target as HTMLElement).closest('[role="checkbox"]')) return;

        const numericId = parseInt(rowId, 10);

        if (event.shiftKey && lastClickedRowRef.current !== null) {
            const start = Math.min(lastClickedRowRef.current, numericId);
            const end = Math.max(lastClickedRowRef.current, numericId);
            const indices: number[] = [];
            Object.keys(rowSelection).forEach(k => { if (rowSelection[k]) indices.push(Number(k)); });
            for (let i = start; i <= end; i++) {
                if (!indices.includes(i)) indices.push(i);
            }
            onSelectedFeaturesChange?.(rowIndicesToFeatureRefs(indices));
        } else if (event.ctrlKey || event.metaKey) {
            const currentIndices = Object.keys(rowSelection).filter(k => rowSelection[k]).map(Number);
            const newIndices = currentIndices.includes(numericId)
                ? currentIndices.filter(i => i !== numericId)
                : [...currentIndices, numericId];
            onSelectedFeaturesChange?.(rowIndicesToFeatureRefs(newIndices));
            lastClickedRowRef.current = numericId;
        } else {
            onSelectedFeaturesChange?.(rowIndicesToFeatureRefs([numericId]));
            lastClickedRowRef.current = numericId;
            const row = rowData[numericId];
            if (row?.feature.geometry) {
                zoomTo(row.feature, row.sourceCRS, { maxZoom: row.maxZoomLevel });
            }
        }
    }, [rowSelection, rowData, rowIndicesToFeatureRefs, onSelectedFeaturesChange, zoomTo]);

    const handleLayerChange = useCallback((index: number) => {
        setSelectedLayerIndex(index);
        setFilter({ column: 'all', value: '' });
        setColumnVisibility({});
        setExpandedTables({});
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
        lastClickedRowRef.current = null;
        onSelectedFeaturesChange?.([]);
    }, [onSelectedFeaturesChange]);

    const handleRowSelectionChange = useCallback((updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
        const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
        const selectedIndices = Object.keys(newSelection).filter(key => newSelection[key]).map(Number);

        onSelectedFeaturesChange?.(rowIndicesToFeatureRefs(selectedIndices));

        const newSelectedRows = selectedIndices.map(i => rowData[i]).filter(Boolean);
        if (newSelectedRows.length === 0) {
            onHighlightChange?.([]);
            return;
        }

        const highlights: HighlightFeature[] = newSelectedRows
            .filter(row => row.feature.geometry)
            .map(row => ({
                id: row.feature.id as string | number,
                geometry: row.feature.geometry!,
                properties: row.feature.properties || {}
            }));
        onHighlightChange?.(highlights);
    }, [rowSelection, rowData, rowIndicesToFeatureRefs, onSelectedFeaturesChange, onHighlightChange]);

    const handleClearSelection = useCallback(() => {
        onSelectedFeaturesChange?.([]);
        lastClickedRowRef.current = null;
        onHighlightChange?.([]);
    }, [onSelectedFeaturesChange, onHighlightChange]);

    const columns = useTableColumns(columnConfigs, selectedLayer?.relatedTables);

    const globalFilter = filter.column === 'all' ? debouncedFilterValue : '';
    const columnFilters = useMemo(() => {
        if (filter.column !== 'all' && debouncedFilterValue) {
            return [{ id: filter.column, value: debouncedFilterValue }];
        }
        return EMPTY_COLUMN_FILTERS;
    }, [filter.column, debouncedFilterValue]);

    const table = useReactTable({
        data: rowData,
        columns,
        getRowId: (_, index) => String(index),
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: handleRowSelectionChange,
        onPaginationChange: setPagination,
        enableRowSelection: true,
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
        state: {
            globalFilter,
            columnFilters,
            columnVisibility,
            rowSelection,
            pagination,
        },
        meta: {
            expandedTables,
            setExpandedTables,
            relatedDataMaps,
            relatedLoading,
        },
    });

    const selectedRows = useMemo(
        () => table.getSelectedRowModel().rows.map(r => r.original),
        [table, rowSelection],
    );
    const hasSelection = selectedRows.length > 0;

    const handleZoomToSelected = useCallback(() => {
        if (selectedRows.length === 0) return;
        const features = selectedRows.map(r => r.feature);
        zoomToAll(features, selectedRows[0].sourceCRS, { maxZoom: selectedRows[0].maxZoomLevel });
    }, [selectedRows, zoomToAll]);

    // Export emits all feature properties (not just popupFields/visible columns).
    // Filter state determines row scope; column visibility is UI-only.
    const handleExport = useCallback((format: TableExportFormat) => {
        const filteredRows = table.getFilteredRowModel().rows.map(r => r.original);
        exportTableData({
            format,
            dataToExport: hasSelection ? selectedRows : filteredRows,
            layerTitle: selectedLayer?.layerTitle || '',
            columnConfigs,
            relatedTables: selectedLayer?.relatedTables || [],
            relatedDataMaps,
            includeRelated: includeRelatedInExport,
        });
    }, [hasSelection, selectedRows, table, selectedLayer, columnConfigs, relatedDataMaps, includeRelatedInExport]);

    const hasRelatedTables = (selectedLayer?.relatedTables?.length ?? 0) > 0;

    // Total count across all layers (includes raster-only as 1)
    const totalCount = layersWithData.reduce((sum, layer) => {
        const featureCount = layer.features?.length || 0;
        if (featureCount > 0) return sum + featureCount;
        if (hasRasterData(layer)) return sum + 1;
        return sum;
    }, 0);

    if (totalCount === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground gap-3">
                <Table2 className="h-8 w-8 opacity-50" />
                <p className="text-sm">Click on the map to query features</p>
                {onClose && (
                    <Button variant="outline" size="sm" onClick={onClose} className="gap-2">
                        <Map className="h-4 w-4" />
                        Go to Map
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header row 1: Layer selector + close */}
            <div className="flex items-center justify-between gap-2 py-1.5 px-2 md:px-4 border-b shrink-0 bg-background">
                {layersWithData.length > 1 ? (
                    <select
                        value={selectedLayerIndex}
                        onChange={(e) => handleLayerChange(Number(e.target.value))}
                        className="h-7 px-2 rounded border border-input bg-background text-sm font-medium truncate flex-1 min-w-0"
                    >
                        {layersWithData.map((layer, index) => {
                            const title = layer.layerTitle || layer.groupLayerTitle;
                            const count = layer.features?.length || 0;
                            return (
                                <option key={title} value={index}>
                                    {title} ({count})
                                </option>
                            );
                        })}
                    </select>
                ) : (
                    <span className="text-sm font-medium truncate">
                        {selectedLayer?.layerTitle || selectedLayer?.groupLayerTitle} ({rowData.length})
                    </span>
                )}
                {onViewModeChange && (
                    <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                            variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => onViewModeChange('map')}
                            className="h-7 w-7 p-0"
                            title="Map view"
                        >
                            <Map className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'split' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => onViewModeChange('split')}
                            className="h-7 w-7 p-0"
                            title="Split view"
                        >
                            <SplitSquareVertical className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => onViewModeChange('table')}
                            className="h-7 w-7 p-0"
                            title="Table view"
                        >
                            <Table2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                {onClose && (
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 shrink-0" title="Clear results">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Header row 2: Selection actions / Column filter + search */}
            <div className="flex items-center gap-2 py-1.5 px-2 md:px-4 border-b shrink-0 bg-muted/30">
                {hasSelection ? (
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-muted-foreground">
                            {selectedRows.length} selected
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={handleZoomToSelected}
                        >
                            <MapPin className="h-3 w-3 mr-1" />
                            Zoom
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={handleClearSelection}
                        >
                            <X className="h-3 w-3 mr-1" />
                            Clear
                        </Button>
                    </div>
                ) : (
                    <>
                        <select
                            value={filter.column}
                            onChange={(e) => setFilter({ column: e.target.value, value: '' })}
                            className="h-7 px-2 rounded border border-input bg-background text-sm shrink-0"
                        >
                            <option value="all">All</option>
                            {columnConfigs.map((config) => (
                                <option key={config.id} value={config.id}>
                                    {config.label}
                                </option>
                            ))}
                        </select>
                        <Input
                            placeholder="Search..."
                            value={filter.value}
                            onChange={(e) => setFilter(prev => ({ ...prev, value: e.target.value }))}
                            className="h-7 flex-1 min-w-0 text-sm"
                        />
                    </>
                )}

                {!disableExport && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-muted-foreground"
                                title={hasSelection ? `Export ${selectedRows.length} selected` : 'Export all'}
                            >
                                <Download className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport('csv')}>
                                CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('geojson')}>
                                GeoJSON
                            </DropdownMenuItem>
                            {GDAL_TABLE_FORMATS.map(({ format, label, hint }) => (
                                <DropdownMenuItem key={format} onClick={() => handleExport(format)}>
                                    {label}
                                    <span className="ml-auto text-xs text-muted-foreground">{hint}</span>
                                </DropdownMenuItem>
                            ))}
                            {hasRelatedTables && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                        Options
                                    </DropdownMenuLabel>
                                    <DropdownMenuCheckboxItem
                                        checked={includeRelatedInExport}
                                        onCheckedChange={setIncludeRelatedInExport}
                                        onSelect={(e) => e.preventDefault()}
                                    >
                                        Include related data
                                    </DropdownMenuCheckboxItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                        >
                            <Columns3 className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-60 overflow-auto">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => (
                                <label
                                    key={column.id}
                                    className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-sm cursor-pointer"
                                >
                                    <Checkbox
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                    />
                                    <span>{column.columnDef.meta?.columnConfig?.label || (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)}</span>
                                </label>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <div className="h-full overflow-auto">
                    <Table style={{ minWidth: table.getCenterTotalSize() }}>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header, index) => (
                                        <TableHead
                                            key={header.id}
                                            style={{ width: header.getSize() }}
                                            className={cn("whitespace-nowrap relative group", index === 0 && "pl-2")}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                            {/* Resize handle — contained within column to avoid overlapping next column's sort button */}
                                            {header.column.getCanResize() && (
                                                <div
                                                    onMouseDown={header.getResizeHandler()}
                                                    onTouchStart={header.getResizeHandler()}
                                                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none group/resize"
                                                >
                                                    <div className={cn(
                                                        "absolute right-0 top-0 h-full w-px pointer-events-none",
                                                        "bg-border group-hover/resize:bg-primary",
                                                        header.column.getIsResizing() && "bg-primary"
                                                    )} />
                                                </div>
                                            )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.length ? (
                                table.getRowModel().rows.map((row, index) => (
                                    <Fragment key={row.id}>
                                        <TableRow
                                            data-row-index={index}
                                            onClick={(e) => handleRowClick(row.id, e)}
                                            className={cn(
                                                "cursor-pointer hover:bg-muted/50",
                                                row.getIsSelected() && "bg-primary/10"
                                            )}
                                        >
                                            {row.getVisibleCells().map((cell, cellIndex) => (
                                                <TableCell
                                                    key={cell.id}
                                                    style={{ width: cell.column.getSize() }}
                                                    className={cn("py-1.5", cellIndex === 0 && "pl-2")}
                                                >
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                        {table.options.meta?.expandedTables[row.id] != null && selectedLayer?.relatedTables && (() => {
                                            const tableIndex = table.options.meta!.expandedTables[row.id]!;
                                            const relatedTable = selectedLayer.relatedTables[tableIndex];
                                            if (!relatedTable) return null;

                                            const targetValue = String(row.original.properties[relatedTable.targetField!] ?? '');
                                            const dataMap = table.options.meta!.relatedDataMaps[tableIndex];
                                            const relatedRows = dataMap?.get(targetValue) || [];

                                            return (
                                                <ExpandedRelatedTable
                                                    key={`${row.id}-expanded`}
                                                    relatedTable={relatedTable}
                                                    rows={relatedRows}
                                                    colSpan={columns.length}
                                                />
                                            );
                                        })()}
                                    </Fragment>
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
                </div>
            </div>

            <TablePagination table={table} totalRows={rowData.length} />
        </div>
    );
}
