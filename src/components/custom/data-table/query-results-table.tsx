import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
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
    ChevronFirst,
    ChevronLast,
    ChevronLeft,
    ChevronRight,
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
import type { LayerContentProps, ExtendedFeature } from '@/components/custom/popups/popup-content-with-pagination';
import type { SelectedFeatureRef } from '@/hooks/use-map-url-sync';
import type { HighlightFeature } from '@/components/maps/types';
import { useMap } from '@/hooks/use-map';
import { zoomToFeature, zoomToFeatures } from '@/lib/map/utils';
import { downloadCSV, downloadGeoJSON } from '@/lib/download-utils';
import { cn } from '@/lib/utils';

type ViewMode = 'map' | 'split' | 'table';

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

interface ColumnConfig {
    id: string;
    label: string;
    field: string;
}

interface RowData {
    id: string;
    sourceCRS: string;
    layerTitle: string;
    feature: ExtendedFeature;
    properties: Record<string, unknown>;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const EMPTY_COLUMN_FILTERS: { id: string; value: string }[] = [];

type OpenDropdown = 'none' | 'export' | 'columns';

export function QueryResultsTable({ layerContent, onClose, viewMode, onViewModeChange, selectedFeatureRefs = [], onSelectedFeaturesChange, onHighlightChange }: QueryResultsTableProps) {
    const { map } = useMap();
    const mapRef = useRef(map);
    mapRef.current = map;

    // Filter to only layers with features
    const layersWithFeatures = useMemo(() =>
        layerContent.filter(layer => layer.features && layer.features.length > 0),
        [layerContent]
    );

    const [selectedLayerIndex, setSelectedLayerIndex] = useState(0);
    const [filter, setFilter] = useState({ column: 'all', value: '' });
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [openDropdown, setOpenDropdown] = useState<OpenDropdown>('none');
    const lastClickedRowRef = useRef<number | null>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        if (openDropdown === 'none') return;
        const handleClick = () => setOpenDropdown('none');
        // Delay to avoid closing immediately on the same click
        const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('click', handleClick);
        };
    }, [openDropdown]);

    // Get the currently selected layer
    const selectedLayer = layersWithFeatures[selectedLayerIndex] || null;

    // Get rows for selected layer only
    const rowData = useMemo((): RowData[] => {
        if (!selectedLayer?.features) return [];

        return selectedLayer.features.map((feature, i) => ({
            id: `${selectedLayer.layerTitle}-${feature.id || i}`,
            layerTitle: selectedLayer.layerTitle || selectedLayer.groupLayerTitle,
            sourceCRS: selectedLayer.sourceCRS,
            feature,
            properties: feature.properties || {},
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
        if (selectedLayer?.popupFields) {
            return Object.entries(selectedLayer.popupFields).map(([label, fieldConfig]) => ({
                id: fieldConfig.field,
                label,
                field: fieldConfig.field,
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

            // Zoom and highlight single feature (use rowIndex for rowData access)
            const row = rowData[numericId];
            const currentMap = mapRef.current;
            if (currentMap && row && row.feature.geometry) {
                onHighlightChange?.([{
                    id: row.feature.id as string | number,
                    geometry: row.feature.geometry,
                    properties: row.feature.properties || {}
                }]);
                zoomToFeature(row.feature, currentMap, row.sourceCRS);
            }
        }
    }, [rowSelection, rowData, rowIndicesToFeatureRefs, onSelectedFeaturesChange, onHighlightChange]);

    // Handle column filter selection change
    const handleFilterColumnChange = useCallback((value: string) => {
        setFilter({ column: value, value: '' });
    }, []);

    // Handle layer tab change
    const handleLayerChange = useCallback((index: number) => {
        setSelectedLayerIndex(index);
        setFilter({ column: 'all', value: '' });
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
        const currentMap = mapRef.current;
        if (!currentMap || selectedRows.length === 0) return;

        // Highlight selected features (declarative)
        const highlights: HighlightFeature[] = selectedRows
            .filter(row => row.feature.geometry)
            .map(row => ({
                id: row.feature.id as string | number,
                geometry: row.feature.geometry!,
                properties: row.feature.properties || {}
            }));
        onHighlightChange?.(highlights);

        // Zoom to fit all
        const features = selectedRows.map(r => r.feature);
        zoomToFeatures(features, currentMap, selectedRows[0].sourceCRS);
    }, [selectedRows, onHighlightChange]);

    // Clear selection
    const handleClearSelection = useCallback(() => {
        onSelectedFeaturesChange?.([]);
        lastClickedRowRef.current = null;
        onHighlightChange?.([]);
    }, [onSelectedFeaturesChange, onHighlightChange]);

    // Export handlers
    const handleExport = useCallback((format: 'csv' | 'geojson') => {
        setOpenDropdown('none');
        const dataToExport = hasSelection ? selectedRows : rowData;
        const timestamp = new Date().toISOString().split('T')[0];
        const layerName = (selectedLayer?.layerTitle || 'export').replace(/\s+/g, '-').toLowerCase();
        const filename = `${layerName}-${timestamp}`;

        if (format === 'csv') {
            const headers = columnConfigs.map(c => c.field);
            downloadCSV(dataToExport, filename, headers, (row, key) => row.properties[key]);
        } else {
            // Convert to format expected by downloadGeoJSON
            const geoData = dataToExport.map(row => ({
                ...row.properties,
                geometry: row.feature.geometry,
            }));
            downloadGeoJSON(geoData, filename, { geometryKey: 'geometry' });
        }
    }, [hasSelection, selectedRows, rowData, selectedLayer, columnConfigs]);

    // Build columns dynamically for selected layer
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
            cols.push({
                id: config.id,
                accessorFn: (row) => row.properties[config.field],
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    >
                        {config.label}
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
                filterFn: 'includesString',
            });
        }

        return cols;
    }, [columnConfigs]);

    // Derive filters from filter state
    const globalFilter = filter.column === 'all' ? filter.value : '';
    const columnFilters = useMemo(() => {
        if (filter.column !== 'all' && filter.value) {
            return [{ id: filter.column, value: filter.value }];
        }
        return EMPTY_COLUMN_FILTERS;
    }, [filter]);

    const table = useReactTable({
        data: rowData,
        columns,
        getRowId: (_, index) => String(index), // Use array index for row ID, not data.id
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: handleRowSelectionChange,
        enableRowSelection: true,
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
        state: {
            globalFilter,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
        initialState: {
            pagination: {
                pageSize: 25,
            },
        },
    });

    // Total feature count across all layers
    const totalFeatures = layersWithFeatures.reduce(
        (sum, layer) => sum + (layer.features?.length || 0), 0
    );

    if (totalFeatures === 0) {
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
                {layersWithFeatures.length > 1 ? (
                    <select
                        value={selectedLayerIndex}
                        onChange={(e) => handleLayerChange(Number(e.target.value))}
                        className="h-7 px-2 rounded border border-input bg-background text-sm font-medium truncate flex-1 min-w-0"
                    >
                        {layersWithFeatures.map((layer, index) => {
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
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'export' ? 'none' : 'export'); }}
                        className="h-6 px-2 text-xs text-muted-foreground"
                        title={hasSelection ? `Export ${selectedRows.length} selected` : 'Export all'}
                    >
                        <Download className="h-3 w-3" />
                    </Button>
                    {openDropdown === 'export' && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-20">
                            <button
                                onClick={() => handleExport('csv')}
                                className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted"
                            >
                                CSV
                            </button>
                            <button
                                onClick={() => handleExport('geojson')}
                                className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted"
                            >
                                GeoJSON
                            </button>
                        </div>
                    )}
                </div>

                {/* Column visibility picker */}
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'columns' ? 'none' : 'columns'); }}
                        className="h-6 px-2 text-xs text-muted-foreground"
                    >
                        <Columns3 className="h-3 w-3" />
                    </Button>
                    {openDropdown === 'columns' && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg p-2 min-w-40 max-h-60 overflow-auto">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    const config = columnConfigs.find(c => c.id === column.id);
                                    return (
                                        <label
                                            key={column.id}
                                            className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                            />
                                            <span>{config?.label || column.id}</span>
                                        </label>
                                    );
                                })}
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <div className="h-full overflow-auto">
                    <Table style={{ width: table.getCenterTotalSize() }}>
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
                                    <TableRow
                                        key={row.id}
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
