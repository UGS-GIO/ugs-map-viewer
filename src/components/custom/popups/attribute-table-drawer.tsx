import { useState, useMemo, useCallback } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    ColumnDef,
    flexRender,
    SortingState,
} from '@tanstack/react-table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/custom/button';
import { Download, ArrowUpDown, Maximize2, Minimize2, LayoutGrid, X } from 'lucide-react';
import { LayerContentProps, ExtendedFeature } from '@/components/custom/popups/popup-content-with-pagination';
import { useMap } from '@/hooks/use-map';
import { clearGraphics, highlightFeature } from '@/lib/map/highlight-utils';
import { zoomToFeature } from '@/lib/map/utils';
import { cn } from '@/lib/utils';
import {
    FieldConfig,
    StringPopupFieldConfig,
    NumberPopupFieldConfig,
    CustomPopupFieldConfig,
} from '@/lib/types/mapping-types';

interface AttributeTableDrawerProps {
    layerContent: LayerContentProps[];
    triggerRef: React.RefObject<HTMLButtonElement>;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSwitchToCards?: () => void;
}

// Type guards
const isNumberField = (field: FieldConfig | undefined): field is NumberPopupFieldConfig =>
    !!field && field.type === 'number';

const isStringField = (field: FieldConfig | undefined): field is StringPopupFieldConfig =>
    !!field && field.type === 'string';

const isCustomField = (field: FieldConfig | undefined): field is CustomPopupFieldConfig =>
    !!field && field.type === 'custom';

// Format numeric values
const formatWithSigFigs = (value: number, decimalPlaces: number): string => {
    if (isNaN(value)) return 'N/A';
    return Number(value.toFixed(decimalPlaces)).toString();
};

const getDefaultTransform = (config: NumberPopupFieldConfig): ((value: number) => string) => {
    return (value: number) => {
        const numericValue = typeof value === 'number' && !isNaN(value) ? value : 0;
        let formatted = config.decimalPlaces
            ? formatWithSigFigs(numericValue, config.decimalPlaces)
            : numericValue.toString();

        if (config.unit) {
            formatted += ` ${config.unit}`;
        }
        return formatted;
    };
};

const processFieldValue = (field: StringPopupFieldConfig | NumberPopupFieldConfig, rawValue: unknown): string => {
    if (field.type === 'number') {
        const numberForTransform = rawValue === null ? null : Number(rawValue);
        const numberForDefault = Number(rawValue ?? 0);

        if (field.transform) {
            return field.transform(numberForTransform) || '';
        }
        return getDefaultTransform(field)(numberForDefault);
    }

    if (field.transform) {
        return field.transform(rawValue === null ? null : String(rawValue)) || '';
    }
    return String(rawValue ?? '');
};

// Generate columns from popupFields configuration
const generateColumns = (
    layer: LayerContentProps,
    onRowClick: (feature: ExtendedFeature) => void
): ColumnDef<ExtendedFeature>[] => {
    const { popupFields } = layer;

    if (!popupFields || Object.keys(popupFields).length === 0) {
        // Fallback: use all properties from first feature
        const firstFeature = layer.features[0];
        if (!firstFeature?.properties) return [];

        return Object.keys(firstFeature.properties).map((key) => ({
            accessorKey: `properties.${key}`,
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className="h-8 p-0 hover:bg-transparent"
                >
                    {key}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const value = row.original.properties?.[key];
                return (
                    <div
                        className="cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded"
                        onClick={() => onRowClick(row.original)}
                    >
                        {String(value ?? '')}
                    </div>
                );
            },
        }));
    }

    // Use popupFields configuration
    return Object.entries(popupFields).map(([label, fieldConfig]) => {
        const field = fieldConfig.field;

        return {
            accessorKey: `properties.${field}`,
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className="h-8 p-0 hover:bg-transparent"
                >
                    {label}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const rawValue = row.original.properties?.[field];
                let displayValue: string;

                if (isCustomField(fieldConfig)) {
                    displayValue = fieldConfig.transform?.(row.original.properties || {})?.toString() || '';
                } else if (isStringField(fieldConfig) || isNumberField(fieldConfig)) {
                    displayValue = processFieldValue(fieldConfig, rawValue);
                } else {
                    displayValue = String(rawValue ?? '');
                }

                return (
                    <div
                        className="cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded"
                        onClick={() => onRowClick(row.original)}
                    >
                        {displayValue}
                    </div>
                );
            },
            sortingFn: (rowA, rowB) => {
                const aValue = rowA.original.properties?.[field];
                const bValue = rowB.original.properties?.[field];

                // Handle null/undefined
                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return 1;
                if (bValue == null) return -1;

                // Number sorting
                if (isNumberField(fieldConfig)) {
                    const aNum = Number(aValue);
                    const bNum = Number(bValue);
                    return aNum - bNum;
                }

                // String sorting
                return String(aValue).localeCompare(String(bValue));
            },
        };
    });
};

// CSV export function
const exportToCSV = (layer: LayerContentProps) => {
    const { popupFields, features, layerTitle, groupLayerTitle } = layer;

    if (features.length === 0) return;

    // Determine headers
    let headers: string[];
    let fieldKeys: string[];

    if (popupFields && Object.keys(popupFields).length > 0) {
        headers = Object.keys(popupFields);
        fieldKeys = Object.values(popupFields).map(f => f.field);
    } else {
        const firstFeature = features[0];
        if (!firstFeature?.properties) return;
        headers = Object.keys(firstFeature.properties);
        fieldKeys = headers;
    }

    // Build CSV rows
    const rows = features.map((feature) => {
        return fieldKeys.map((key, idx) => {
            const rawValue = feature.properties?.[key];
            let displayValue: string;

            if (popupFields) {
                const fieldConfig = Object.values(popupFields)[idx];
                if (isCustomField(fieldConfig)) {
                    displayValue = fieldConfig.transform?.(feature.properties || {})?.toString() || '';
                } else if (isStringField(fieldConfig) || isNumberField(fieldConfig)) {
                    displayValue = processFieldValue(fieldConfig, rawValue);
                } else {
                    displayValue = String(rawValue ?? '');
                }
            } else {
                displayValue = String(rawValue ?? '');
            }

            // Escape CSV values
            if (displayValue.includes(',') || displayValue.includes('"') || displayValue.includes('\n')) {
                return `"${displayValue.replace(/"/g, '""')}"`;
            }
            return displayValue;
        });
    });

    // Combine into CSV
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${layerTitle || groupLayerTitle}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Single layer table component
const LayerTable = ({ layer }: { layer: LayerContentProps }) => {
    const { map } = useMap();
    const [sorting, setSorting] = useState<SortingState>([]);

    const handleRowClick = useCallback(async (feature: ExtendedFeature) => {
        if (!map) return;

        const title = layer.layerTitle || layer.groupLayerTitle;

        try {
            clearGraphics(map);
            await highlightFeature(feature, map, layer.sourceCRS, title);
            zoomToFeature(feature, map, layer.sourceCRS);
        } catch (error) {
            console.error('[AttributeTable] Error highlighting feature:', error);
        }
    }, [map, layer.layerTitle, layer.groupLayerTitle, layer.sourceCRS]);

    const columns = useMemo(
        () => generateColumns(layer, handleRowClick),
        [layer, handleRowClick]
    );

    const table = useReactTable({
        data: layer.features,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: setSorting,
        state: {
            sorting,
        },
    });

    return (
        <div className="flex flex-col h-full px-4 pb-2">
            <div className="flex justify-between items-center mb-1">
                <div className="text-sm text-muted-foreground">
                    {layer.features.length} feature{layer.features.length !== 1 ? 's' : ''}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(layer)}
                    className="flex gap-2"
                >
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>
            <div className="flex-1 overflow-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && 'selected'}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export function AttributeTableDrawer({ layerContent, triggerRef, isOpen, onOpenChange, onSwitchToCards }: AttributeTableDrawerProps) {
    const [isMaximized, setIsMaximized] = useState(false);

    // Update activeTab when layerContent changes
    const activeTab = layerContent.length > 0
        ? `${layerContent[0].groupLayerTitle}-${layerContent[0].layerTitle}`
        : '';
    const [selectedTab, setSelectedTab] = useState<string>(activeTab);

    // Single layer - no tabs
    const renderContent = () => {
        if (layerContent.length === 0) {
            return (
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No data available</p>
                </div>
            );
        }

        if (layerContent.length === 1) {
            return (
                <div className="h-full">
                    <LayerTable layer={layerContent[0]} />
                </div>
            );
        }

        // Multiple layers - use tabs
        return (
            <Tabs value={selectedTab || activeTab} onValueChange={setSelectedTab} className="h-full flex flex-col">
                <TabsList className="mx-4 my-1 flex-shrink-0">
                    {layerContent.map((layer) => {
                        const tabId = `${layer.groupLayerTitle}-${layer.layerTitle}`;
                        const tabLabel = layer.layerTitle && layer.layerTitle !== layer.groupLayerTitle
                            ? layer.layerTitle
                            : layer.groupLayerTitle;

                        return (
                            <TabsTrigger key={tabId} value={tabId}>
                                {tabLabel}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
                {layerContent.map((layer) => {
                    const tabId = `${layer.groupLayerTitle}-${layer.layerTitle}`;
                    return (
                        <TabsContent
                            key={tabId}
                            value={tabId}
                            className="flex-1 overflow-hidden"
                        >
                            <LayerTable layer={layer} />
                        </TabsContent>
                    );
                })}
            </Tabs>
        );
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange} modal={false}>
            <SheetTrigger asChild>
                <Button ref={triggerRef} className="hidden">
                    Open Attribute Table
                </Button>
            </SheetTrigger>
            <SheetContent
                side="bottom"
                className={cn(
                    "w-full border-t border-border shadow-2xl",
                    "bg-background/95 backdrop-blur-lg",
                    "transition-all duration-300 ease-in-out",
                    "p-0", // Remove default padding
                    isMaximized ? "h-[90vh]" : "h-[50vh]",
                    "[&>button]:hidden" // Hide the default close button
                )}
                onInteractOutside={(e: Event) => {
                    // Allow interaction with map and other elements
                    e.preventDefault();
                }}
            >
                <SheetHeader className="flex flex-row items-center justify-between border-b border-border/50 px-4 py-2">
                    <SheetTitle>Attribute Table</SheetTitle>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (onSwitchToCards) {
                                    onSwitchToCards();
                                }
                            }}
                            className="flex gap-2"
                        >
                            <LayoutGrid className="h-4 w-4" />
                            <span className="hidden md:inline">Card View</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="h-8 w-8"
                        >
                            {isMaximized ? (
                                <Minimize2 className="h-4 w-4" />
                            ) : (
                                <Maximize2 className="h-4 w-4" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onOpenChange(false)}
                            className="h-8 w-8"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </SheetHeader>

                <div className="h-[calc(100%-3.5rem)] overflow-hidden">
                    {renderContent()}
                </div>
            </SheetContent>
        </Sheet>
    );
}
