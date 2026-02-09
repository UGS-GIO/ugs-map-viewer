import { useMemo, useState, useCallback, useRef, useEffect, Fragment } from 'react';
import { useDebounce } from 'use-debounce';
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type VisibilityState,
    type RowSelectionState,
    type RowData as TanstackRowData,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
    ChevronFirst,
    ChevronLast,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    X,
    Table2,
    Download,
    Columns3,
    MapPin,
    Map,
    SplitSquareVertical,
} from 'lucide-react';
import { hasRasterData, type LayerContentProps, type ExtendedFeature } from '@/components/maps/popups/types';
import type { ColumnConfig, RowData, ViewMode } from './types';
import type { SelectedFeatureRef } from '@/hooks/use-map-url-sync';
import type { HighlightFeature } from '@/components/maps/types';
import { formatFieldValue } from '@/lib/field-formatting';
import { useZoomToFeature } from '@/hooks/use-zoom-to-feature';
import { cn } from '@/lib/utils';
import { useBulkRelatedTable } from '@/hooks/use-bulk-related-table';
import { exportTableData } from './table-export-utils';
import { ExpandedRelatedTable } from './expanded-related-table';

// TanStack Table meta augmentation - allows type-safe access to shared state in cell renderers
// without including it in column def dependencies (avoids unnecessary column recreation)
declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData extends TanstackRowData> {
        expandedTables: Record<string, number | null>;
        setExpandedTables: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
        relatedDataMaps: import('@/hooks/use-bulk-related-table').RelatedDataMap[];
        relatedLoading: boolean;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends TanstackRowData, TValue> {
        columnConfig?: ColumnConfig;
    }
}

interface QueryResultsTableProps {
    layerContent: LayerContentProps[];
    onClose?: () => void;
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    /** Selected feature refs from URL (layer:id pairs) */
    selectedFeatureRefs?: SelectedFeatureRef[];
    /** Callback when selected features change */
    onSelectedFeaturesChange?: (refs: SelectedFeatureRef[]) => void;
    /** Callback when highlighted features change (declarative highlighting) */
    onHighlightChange?: (features: HighlightFeature[]) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const EMPTY_COLUMN_FILTERS: { id: string; value: string }[] = [];

export function QueryResultsTable({ layerContent, onClose, viewMode, onViewModeChange, selectedFeatureRefs = [], onSelectedFeaturesChange, onHighlightChange }: QueryResultsTableProps) {
    const { zoomTo, zoomToAll } = useZoomToFeature({ onHighlightChange });

    // Filter to layers with features OR raster data
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
    const lastClickedRowRef = useRef<number | null>(null);

    // Clamp selectedLayerIndex if layersWithData shrinks
    useEffect(() => {
        if (selectedLayerIndex >= layersWithData.length && layersWithData.length > 0) {
            setSelectedLayerIndex(0);
        }
    }, [selectedLayerIndex, layersWithData.length]);

    // Get the currently selected layer
    const selectedLayer = layersWithData[selectedLayerIndex] || null;

    // Get rows for selected layer only
    const rowData = useMemo((): RowData[] => {
        if (!selectedLayer) return [];

        // Handle raster-only layers
        if (selectedLayer.features.length === 0 && hasRasterData(selectedLayer)) {
            const rasterSource = selectedLayer.rasterSource!;
            const rasterValue = rasterSource.data?.features?.[0]?.properties?.[rasterSource.valueField];
            const displayValue = rasterSource.transform
                ? rasterSource.transform(rasterValue)
                : String(rasterValue ?? 'N/A');

            // Create a synthetic row for raster data
            const syntheticFeature: ExtendedFeature = {
                type: 'Feature',
                id: 'raster-0',
                geometry: { type: 'Point', coordinates: [0, 0] },
                properties: { [rasterSource.valueLabel]: displayValue },
                namespace: selectedLayer.layerTitle || selectedLayer.groupLayerTitle,
            };

            return [{
                id: `${selectedLayer.layerTitle}-raster-0`,
                layerTitle: selectedLayer.layerTitle || selectedLayer.groupLayerTitle,
                sourceCRS: selectedLayer.sourceCRS,
                feature: syntheticFeature,
                properties: syntheticFeature.properties || {},
                maxZoomLevel: selectedLayer.maxZoomLevel,
            }];
        }

        return selectedLayer.features.map((feature, i) => ({
            id: `${selectedLayer.layerTitle}-${feature.id || i}`,
            layerTitle: selectedLayer.layerTitle || selectedLayer.groupLayerTitle,
            sourceCRS: selectedLayer.sourceCRS,
            feature,
            properties: feature.properties || {},
            maxZoomLevel: selectedLayer.maxZoomLevel,
        }));
    }, [selectedLayer]);

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

    // Helper to convert row indices to feature refs
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

    // Get column configs for selected layer only
    // Falls back to auto-generating columns from feature properties if no popupFields
    const columnConfigs = useMemo((): ColumnConfig[] => {
        // Handle raster-only layers
        if (selectedLayer?.features.length === 0 && hasRasterData(selectedLayer)) {
            const rasterSource = selectedLayer.rasterSource!;
            return [{
                id: rasterSource.valueLabel,
                label: rasterSource.valueLabel,
                field: rasterSource.valueLabel,
            }];
        }

        if (selectedLayer?.popupFields && Object.keys(selectedLayer.popupFields).length > 0) {
            const seen = new Set<string>();
            return Object.entries(selectedLayer.popupFields)
                .filter(([, fieldConfig]) => {
                    if (seen.has(fieldConfig.field)) return false;
                    seen.add(fieldConfig.field);
                    return true;
                })
                .map(([label, fieldConfig]) => ({
                    id: fieldConfig.field,
                    label: label || fieldConfig.field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    field: fieldConfig.field,
                    fieldConfig, // Preserve full config for formatting
                }));
        }

        // Auto-generate columns from first feature's properties
        const firstFeature = selectedLayer?.features?.[0];
        if (!firstFeature?.properties) return [];

        return Object.keys(firstFeature.properties)
            .filter(key => key !== 'geometry' && key !== 'bbox') // Exclude geometry fields
            .map(key => ({
                id: key,
                label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), // Format label
                field: key,
            }));
    }, [selectedLayer]);

    // Get all unique target values for related table bulk fetch
    const relatedTableTargetValues = useMemo(() => {
        if (!selectedLayer?.relatedTables?.length) return [];
        return selectedLayer.relatedTables.flatMap(table =>
            rowData.map(row => String(row.properties[table.targetField] ?? ''))
        );
    }, [selectedLayer?.relatedTables, rowData]);

    // Bulk fetch related table data
    const { dataByTable: relatedDataMaps, isLoading: relatedLoading } = useBulkRelatedTable(
        selectedLayer?.relatedTables,
        relatedTableTargetValues
    );

    // Handle row click with shift+click and ctrl+click
    // Uses row.id (global index) not page-relative index for proper selection
    const handleRowClick = useCallback((rowId: string, event: React.MouseEvent) => {
        // Don't handle if clicking on checkbox
        if ((event.target as HTMLElement).closest('[role="checkbox"]')) return;

        const numericId = parseInt(rowId, 10);

        if (event.shiftKey && lastClickedRowRef.current !== null) {
            // Shift+click: select range using global indices
            const start = Math.min(lastClickedRowRef.current, numericId);
            const end = Math.max(lastClickedRowRef.current, numericId);
            const indices: number[] = [];
            // Include existing selection + range
            Object.keys(rowSelection).forEach(k => { if (rowSelection[k]) indices.push(Number(k)); });
            for (let i = start; i <= end; i++) {
                if (!indices.includes(i)) indices.push(i);
            }
            onSelectedFeaturesChange?.(rowIndicesToFeatureRefs(indices));
        } else if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd+click: toggle single row (additive)
            const currentIndices = Object.keys(rowSelection).filter(k => rowSelection[k]).map(Number);
            const newIndices = currentIndices.includes(numericId)
                ? currentIndices.filter(i => i !== numericId)
                : [...currentIndices, numericId];
            onSelectedFeaturesChange?.(rowIndicesToFeatureRefs(newIndices));
            lastClickedRowRef.current = numericId;
        } else {
            // Regular click: select only this row and zoom
            onSelectedFeaturesChange?.(rowIndicesToFeatureRefs([numericId]));
            lastClickedRowRef.current = numericId;

            // Zoom and highlight single feature
            const row = rowData[numericId];
            if (row?.feature.geometry) {
                zoomTo(row.feature, row.sourceCRS, { maxZoom: row.maxZoomLevel });
            }
        }
    }, [rowSelection, rowData, rowIndicesToFeatureRefs, onSelectedFeaturesChange, zoomTo]);

    // Handle column filter selection change
    const handleFilterColumnChange = useCallback((value: string) => {
        setFilter({ column: value, value: '' });
    }, []);

    // Handle layer tab change
    const handleLayerChange = useCallback((index: number) => {
        setSelectedLayerIndex(index);
        setFilter({ column: 'all', value: '' });
        setColumnVisibility({});
        setExpandedTables({});
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
        lastClickedRowRef.current = null;
        onSelectedFeaturesChange?.([]);
    }, [onSelectedFeaturesChange]);

    // Get selected rows
    const selectedRows = useMemo(() => {
        return Object.keys(rowSelection)
            .filter(key => rowSelection[key])
            .map(key => rowData[parseInt(key)])
            .filter(Boolean);
    }, [rowSelection, rowData]);

    const hasSelection = selectedRows.length > 0;

    // Handle row selection change - update URL AND highlight
    const handleRowSelectionChange = useCallback((updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
        const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
        const selectedIndices = Object.keys(newSelection).filter(key => newSelection[key]).map(Number);

        // Update URL with new selection
        onSelectedFeaturesChange?.(rowIndicesToFeatureRefs(selectedIndices));

        // Highlight based on new selection (declarative)
        const newSelectedRows = selectedIndices.map(i => rowData[i]).filter(Boolean);

        if (newSelectedRows.length === 0) {
            onHighlightChange?.([]);
            return;
        }

        // Highlight all selected features
        const highlights: HighlightFeature[] = newSelectedRows
            .filter(row => row.feature.geometry)
            .map(row => ({
                id: row.feature.id as string | number,
                geometry: row.feature.geometry!,
                properties: row.feature.properties || {}
            }));
        onHighlightChange?.(highlights);
    }, [rowSelection, rowData, rowIndicesToFeatureRefs, onSelectedFeaturesChange, onHighlightChange]);

    // Zoom to all selected features
    const handleZoomToSelected = useCallback(() => {
        if (selectedRows.length === 0) return;
        const features = selectedRows.map(r => r.feature);
        zoomToAll(features, selectedRows[0].sourceCRS, { maxZoom: selectedRows[0].maxZoomLevel });
    }, [selectedRows, zoomToAll]);

    // Clear selection
    const handleClearSelection = useCallback(() => {
        onSelectedFeaturesChange?.([]);
        lastClickedRowRef.current = null;
        onHighlightChange?.([]);
    }, [onSelectedFeaturesChange, onHighlightChange]);

    // Build columns dynamically for selected layer
    // Uses columnDef.meta for column config and table.options.meta for shared state,
    // so columns are only recreated when the actual column structure changes.
    const columns = useMemo((): ColumnDef<RowData>[] => {
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

        for (const config of columnConfigs) {
            const isNumeric = config.fieldConfig?.type === 'number';
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
                    return (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 -ml-2"
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
                sortingFn: isNumeric ? 'basic' : 'alphanumeric',
                sortUndefined: 'last',
                filterFn: 'includesString',
            });
        }

        // Add columns for related tables
        // Cell renderers access relatedDataMaps/expandedTables via table.options.meta
        // so these deps don't cause column recreation.
        if (selectedLayer?.relatedTables) {
            selectedLayer.relatedTables.forEach((relatedTable, tableIndex) => {
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
    }, [columnConfigs, selectedLayer?.relatedTables]);

    // Derive filters from filter state (debounced to avoid filtering on every keystroke)
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

    // Export handlers — uses TanStack's filtered model to match what's visible in the table
    const handleExport = useCallback((format: 'csv' | 'geojson') => {
        const filteredRows = table.getFilteredRowModel().rows.map(r => r.original);
        exportTableData({
            format,
            dataToExport: hasSelection ? selectedRows : filteredRows,
            layerTitle: selectedLayer?.layerTitle || '',
            visibleConfigs: columnConfigs.filter(c => columnVisibility[c.id] !== false),
            relatedTables: selectedLayer?.relatedTables || [],
            relatedDataMaps,
        });
    }, [hasSelection, selectedRows, table, selectedLayer, columnConfigs, columnVisibility, relatedDataMaps]);

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
                {/* View mode buttons */}
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
                {/* Selection info and actions */}
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
                            onChange={(e) => handleFilterColumnChange(e.target.value)}
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

                {/* Export dropdown */}
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
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Column visibility picker */}
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
                                    <span>{column.columnDef.meta?.columnConfig?.label || column.id}</span>
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
                                            {/* Resize handle - wider hit area, thin visible line */}
                                            {header.column.getCanResize() && (
                                                <div
                                                    onMouseDown={header.getResizeHandler()}
                                                    onTouchStart={header.getResizeHandler()}
                                                    className="absolute -right-1.5 top-0 h-full w-3 cursor-col-resize select-none touch-none group/resize z-10"
                                                >
                                                    <div className={cn(
                                                        "absolute left-1/2 top-0 h-full w-px -translate-x-1/2 pointer-events-none",
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

                                            const targetValue = String(row.original.properties[relatedTable.targetField] ?? '');
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

            {/* Pagination */}
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
                    {table.getFilteredRowModel().rows.length < rowData.length && (
                        <span className="text-xs text-muted-foreground">
                            {table.getFilteredRowModel().rows.length} of {rowData.length}
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
        </div>
    );
}
