import { Button } from "@/components/ui/button";
import { RelatedDataMap, EMPTY_RELATED_DATA_MAP } from "@/hooks/use-bulk-related-table";
import { Feature, Geometry, GeoJsonProperties } from "geojson";
import { ChevronDown, ChevronRight, ExternalLink, Info } from "lucide-react";
import { RelatedDataTable } from "@/components/maps/popups/related-data-table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LayerContentProps } from "@/components/maps/popups/types";
import { Link } from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumeric } from "@/lib/utils";
import { memo, useMemo, useState, useId, ReactNode } from "react";
import {
    FieldConfig,
    StringPopupFieldConfig,
    ProcessedRasterSource,
    LinkFields,
    ColorCodingRecordFunction,
    ColorCodingMode,
    RelatedTable,
    LinkConfig,
    LinkDefinition,
    ImageFieldConfig,
    PopupFieldsTableConfig,
} from "@/lib/types/mapping-types";
import { PopupImageGallery, type GalleryImage } from "@/components/maps/popups/popup-image-gallery";
import { relatedRowToGalleryImage } from "@/lib/gallery-utils";
import { sanitizeFilename } from "@/lib/download-utils";
import { formatFieldValue } from "@/lib/field-formatting";

interface LabelValuePair {
    label: string | undefined;
    value: ReactNode;
}

interface ProcessedRelatedData {
    labelValuePairs?: LabelValuePair[];
    [key: string]: unknown;
}

type PopupContentDisplayProps = {
    layer: LayerContentProps;
    feature?: Feature<Geometry, GeoJsonProperties>;
    layout?: "grid" | "stacked";
    /** Pre-fetched bulk related data maps (one per relatedTable) */
    bulkRelatedData?: RelatedDataMap[];
};

// --- Utility Functions ---
const getRasterFeatureValue = (rasterSource: ProcessedRasterSource | undefined): number | null => {
    if (!rasterSource?.data?.features?.length) return null;
    const valueField = rasterSource.valueField;
    return rasterSource.data.features[0]?.properties?.[valueField];
};

const getColorStyle = (
    colorCodingMap: ColorCodingRecordFunction | undefined,
    colorCodingMode: ColorCodingMode | undefined,
    fieldKey: string,
    value: string | number
): { style: React.CSSProperties; className: string } => {
    if (!colorCodingMap || !colorCodingMap[fieldKey]) {
        return { style: {}, className: '' };
    }

    const color = colorCodingMap[fieldKey](value);
    const mode = colorCodingMode ?? 'text';

    if (mode === 'background') {
        return {
            style: { backgroundColor: color, color: '#1a1a1a' },
            className: 'px-1.5 py-0.5 rounded inline-block',
        };
    }

    return { style: { color }, className: '' };
};

const getRelatedTableValues = (
    groupedLayerIndex: number,
    data: ProcessedRelatedData[][],
    relatedTables: RelatedTable[] | undefined,
    properties: GeoJsonProperties
): LabelValuePair[][] => {
    if (!data?.length) return [[{ label: "", value: "No data available" }]];

    const table = relatedTables?.[groupedLayerIndex];
    if (!table) return [[{ label: "Invalid index", value: "Invalid index" }]];

    const targetField = properties?.[table.targetField];
    const tableData = data[groupedLayerIndex];

    if (!tableData) return [[{ label: "", value: "No data available" }]];

    // Each matching item becomes its own row (array of labelValuePairs)
    const tableMatches = tableData
        .filter(item =>
            String(item[table.matchingField]) === String(targetField) &&
            item.labelValuePairs
        )
        .map(item => item.labelValuePairs!);

    return tableMatches.length > 0
        ? tableMatches
        : [[{ label: "", value: "No data available" }]];
};

const shouldDisplayValue = (value: string): boolean => {
    if (value === null || value === undefined) return false;
    const trimmedValue = String(value).trim();
    return !(trimmedValue === '' || trimmedValue.toLowerCase() === 'null' || trimmedValue.toLowerCase() === 'undefined');
};

// --- Refactored Link/Content Rendering ---
const renderFieldContent = (
    value: string,
    fieldKey: string,
    properties: GeoJsonProperties | undefined,
    linkFields: LinkFields | undefined,
    urlPattern: RegExp
): JSX.Element | string => {

    const linkConfig: LinkConfig | undefined = linkFields?.[fieldKey];
    const props = properties || {};

    // 1. Check for specific Link Configuration
    if (linkConfig) {
        // Use transform if available, otherwise generate based on baseUrl.
        // Ensure properties are passed if transform needs them.
        const hrefs: LinkDefinition[] = linkConfig.transform
            ? linkConfig.transform(value, props)
            : (linkConfig.baseUrl ? [{ label: value, href: `${linkConfig.baseUrl}${value}` }] : [{ label: value, href: null }]);

        return (
            <>
                {hrefs.map((item, i) => {
                    if (item.href === null || item.href === '') {
                        return <div key={`${item.label}-${i}`}><span className="break-words inline-block">{item.label}</span></div>;
                    }
                    return (
                        <div key={`${item.href}-${i}`} className="flex gap-2">
                            <Link
                                to={item.href}
                                className="p-0 h-auto whitespace-normal text-left font-normal inline-flex items-center max-w-full gap-1"
                                variant='primary'
                            >
                                <span className="break-words inline-flex underline decoration-1">{item.label}</span>
                            </Link>
                        </div>
                    );
                })}
            </>
        );
    }

    // 2. Check for generic URL pattern
    if (urlPattern.test(value)) {
        return (
            <Button
                className="p-0 h-auto whitespace-normal text-left font-normal inline-flex items-start max-w-full"
                variant="link"
                onClick={() => window.open(value, '_blank')}
            >
                <span className="break-all inline-block">{value}</span>
                <ExternalLink className="flex-shrink-0 ml-1 mt-1" size={16} />
            </Button>
        );
    }

    // 3. Fallback: Display as plain text
    return value ?? "N/A";
};

// --- Gallery Image Builder ---
export function buildGalleryImages(
    imageFields: ImageFieldConfig[] | undefined,
    properties: GeoJsonProperties | null,
    relatedTables: RelatedTable[] | undefined,
    data: ProcessedRelatedData[][]
): GalleryImage[] {
    const fromImageFields: GalleryImage[] = (imageFields && properties)
        ? imageFields.flatMap((cfg: ImageFieldConfig) => {
            const value = properties[cfg.field]
            if (!value) return []
            const url = cfg.baseUrl ? `${cfg.baseUrl}/${encodeURIComponent(String(value))}` : String(value)
            return [{ url, label: cfg.label || String(value) }]
        })
        : []

    const fromRelatedTables: GalleryImage[] = (relatedTables ?? []).flatMap((table, tableIndex) => {
        if (table.displayAs !== 'gallery') return []
        const rows = data[tableIndex] ?? []
        return rows.flatMap(row => {
            const img = relatedRowToGalleryImage(row, table)
            return img ? [img] : []
        })
    })

    return [...fromImageFields, ...fromRelatedTables]
}

function CollapsibleSection({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const contentId = useId();
    return (
        <div className="flex flex-col space-y-2">
            <button
                onClick={() => setIsOpen(o => !o)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="flex items-center gap-1 font-bold text-foreground hover:text-foreground/80 hover:bg-muted/50 rounded px-1 -ml-1 transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {isOpen
                    ? <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    : <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                <span className="underline">{label}</span>
                {count !== undefined && (
                    <span
                        aria-label={`${count} item${count === 1 ? '' : 's'}`}
                        className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground no-underline"
                    >
                        {count}
                    </span>
                )}
            </button>
            {isOpen && <div id={contentId}>{children}</div>}
        </div>
    );
}

function InlineSection({ label, children }: { label?: string; children: ReactNode }) {
    return (
        <div className="flex flex-col space-y-2">
            {label && <p className="font-bold underline text-foreground">{label}</p>}
            <div>{children}</div>
        </div>
    );
}

// Shared table used for both related tables and pivoted popup-fields tables. Centralizes the
// header/cell styling so the two call sites can't drift apart. Pass `headers` to render a header
// row; each row is an array of cell contents. (Sortable related tables use RelatedDataTable.)
function PopupTable({ headers, rows }: { headers?: ReactNode[]; rows: ReactNode[][] }) {
    return (
        <Table>
            {headers && (
                <TableHeader>
                    <TableRow>
                        {headers.map((header, idx) => (
                            <TableHead key={idx} className="h-8 text-xs">{header}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
            )}
            <TableBody>
                {rows.map((cells, rowIdx) => (
                    <TableRow key={rowIdx}>
                        {cells.map((cell, cellIdx) => (
                            <TableCell key={cellIdx} className="py-1.5 text-xs">{cell}</TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

// --- Content Builders ---
// Each builder turns one slice of the layer config into an ordered list of render items.
// `isLong` marks full-width content (tables, long text) so the grid layout can span it.
// Keeping these pure and module-level separates data-shaping from the component and lets the
// caller compose them in any order (see relatedTablesPosition) without magic sort indices.
type PopupItem = { content: JSX.Element; isLong: boolean };

const URL_PATTERN = /https?:\/\/[^\s/$.?#].[^\s]*/;

const isFieldConfig = (value: unknown): value is FieldConfig =>
    typeof value === 'object' && value !== null && 'type' in value && 'field' in value;

// One item per popup field (plus the raster value, if present), rendered as a label/value pair.
function buildFeatureFieldItems({ properties, popupFields, rasterSource, rasterValue, colorCodingMap, colorCodingMode, linkFields }: {
    properties: GeoJsonProperties;
    popupFields?: Record<string, FieldConfig>;
    rasterSource?: ProcessedRasterSource;
    rasterValue: number | null;
    colorCodingMap?: ColorCodingRecordFunction;
    colorCodingMode?: ColorCodingMode;
    linkFields?: LinkFields;
}): PopupItem[] {
    const props = properties || {};
    const entries: Array<[string, unknown]> = popupFields ? Object.entries(popupFields) : Object.entries(props);
    if (rasterValue !== null && rasterSource?.valueLabel) {
        entries.push([rasterSource.valueLabel, rasterValue]);
    }

    const items: PopupItem[] = [];
    entries.forEach(([label, entryData], index) => {
        let currentConfig: FieldConfig | undefined;
        let valueFromPropertiesDirectly: unknown;
        const isRasterEntry = label === rasterSource?.valueLabel && entryData === rasterValue;

        if (!isRasterEntry && isFieldConfig(entryData)) {
            currentConfig = entryData;
        } else if (!isRasterEntry) {
            valueFromPropertiesDirectly = entryData;
            currentConfig = { field: label, type: 'string', label } as StringPopupFieldConfig;
        }

        const fieldKey = currentConfig?.field || label;
        let displayValue: string;
        if (isRasterEntry) {
            displayValue = rasterSource?.transform && rasterValue !== null
                ? rasterSource.transform(rasterValue) || ''
                : String(rasterValue ?? '');
        } else if (currentConfig) {
            // formatFieldValue dispatches on field type internally (custom reads from properties,
            // the rest from rawValue), so one call covers every config.
            const rawValue = popupFields ? props[currentConfig.field] : valueFromPropertiesDirectly;
            displayValue = formatFieldValue(currentConfig, rawValue, props);
        } else {
            displayValue = String(entryData ?? '');
        }

        if (!shouldDisplayValue(displayValue)) return;

        const colorStyle = getColorStyle(colorCodingMap, colorCodingMode, fieldKey, displayValue);
        const hasColorStyling = !!colorStyle.className || Object.keys(colorStyle.style).length > 0;
        const description = currentConfig?.description;
        const labelContent = description ? (
            <TooltipProvider delayDuration={200}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1">{label}<Info className="h-3.5 w-3.5 text-muted-foreground" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-64 text-xs">{description}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        ) : label;
        const value = renderFieldContent(displayValue, fieldKey, props, linkFields, URL_PATTERN);

        items.push({
            isLong: String(displayValue).split(/\s+/).length > 20,
            content: (
                <div key={`feature-item-${label}-${index}`} className="flex flex-col">
                    <p className="font-bold underline text-foreground">{labelContent}</p>
                    <div className="break-words text-foreground/80">
                        {hasColorStyling
                            ? <span className={colorStyle.className} style={colorStyle.style}>{value}</span>
                            : value}
                    </div>
                </div>
            ),
        });
    });
    return items;
}

// One item per related table (collapsible or inline section), as a table or label/value list.
function buildRelatedTableItems({ relatedTables, data, properties }: {
    relatedTables?: RelatedTable[];
    data: ProcessedRelatedData[][];
    properties: GeoJsonProperties;
}): PopupItem[] {
    const props = properties || {};
    const items: PopupItem[] = [];
    (relatedTables || []).forEach((table, tableIndex) => {
        const groupedValues = getRelatedTableValues(tableIndex, data, relatedTables, props);
        const flatValues = groupedValues.flat();

        // Skip rendering if no real data (only "No data available" placeholder).
        if (!flatValues.some(v => v.value !== "No data available")) return;

        const useTableFormat = table.displayAs === 'table' && !!table.displayFields && table.displayFields.length > 0;
        const sectionLabel = String(props[table.fieldLabel] || table.fieldLabel);
        const collapsible = table.collapsible ?? sectionLabel.trim() !== '';

        const innerContent = useTableFormat ? (
            // Sortable: raw rows + column defs (TanStack) so sorting is numeric/
            // alphabetical on the underlying values, not the rendered cells.
            <RelatedDataTable
                rows={data[tableIndex] as Record<string, unknown>[]}
                displayFields={table.displayFields!}
                initialSort={table.sortBy ? { id: table.sortBy, desc: table.sortDirection === 'desc' } : undefined}
            />
        ) : (
            <>
                {groupedValues.map((group, groupIdx) => (
                    <div key={`group-${groupIdx}`} className="flex flex-col">
                        {group.map((valueItem, valueIdx) => (
                            <div key={`value-${valueItem.label}-${valueIdx}`} className="flex flex-row gap-x-2">
                                {valueItem.label && <span className="font-bold">{valueItem.label}: </span>}
                                <span>{valueItem.value}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </>
        );

        const content = collapsible ? (
            <CollapsibleSection key={`related-${table.fieldLabel}-${tableIndex}`} label={sectionLabel} count={groupedValues.length}>
                {innerContent}
            </CollapsibleSection>
        ) : (
            <InlineSection key={`related-${table.fieldLabel}-${tableIndex}`} label={sectionLabel || undefined}>
                {innerContent}
            </InlineSection>
        );

        const totalWords = flatValues.map(v => String(v.value)).join(" ").split(/\s+/).length;
        items.push({ content, isLong: useTableFormat || totalWords > 20 || flatValues.length > 3 });
    });
    return items;
}

// One item per popup-fields table: a pivoted (label | value) table in a collapsible dropdown.
function buildFieldsTableItems({ popupFieldsTable, properties }: {
    popupFieldsTable?: PopupFieldsTableConfig[];
    properties: GeoJsonProperties;
}): PopupItem[] {
    const props = properties || {};
    return (popupFieldsTable || []).flatMap((tableConfig, tableIndex) => {
        const rows: ReactNode[][] = tableConfig.fields
            .map(field => ({
                label: field.label,
                value: formatFieldValue(field.config, props[field.config.field], props),
                unit: field.unit,
            }))
            .filter(row => shouldDisplayValue(row.value))
            .map(row => [
                <span className="font-medium">{row.label}</span>,
                row.unit ? `${row.value} ${row.unit}` : row.value,
            ]);

        if (rows.length === 0) return [];

        const headers = (tableConfig.labelHeader || tableConfig.valueHeader)
            ? [tableConfig.labelHeader, tableConfig.valueHeader]
            : undefined;

        return [{
            isLong: true,
            content: (
                <CollapsibleSection key={`popup-fields-table-${tableIndex}`} label={tableConfig.sectionLabel} count={rows.length}>
                    <PopupTable headers={headers} rows={rows} />
                </CollapsibleSection>
            ),
        }];
    });
}

// --- Main Component ---
const PopupContentDisplayInner = ({ feature, layout, layer, bulkRelatedData }: PopupContentDisplayProps) => {
    const { relatedTables, relatedTablesPosition, popupFields, popupFieldsTable, linkFields, imageFields, colorCodingMap, colorCodingMode, rasterSource } = layer;

    // Convert bulk data to the format expected by getRelatedTableValues
    const data = useMemo((): ProcessedRelatedData[][] => {
        if (!bulkRelatedData || !relatedTables) {
            return [];
        }

        // Convert bulk RelatedDataMap to ProcessedRelatedData format
        return relatedTables.map((table, tableIndex) => {
            const dataMap = bulkRelatedData[tableIndex] || EMPTY_RELATED_DATA_MAP;
            const targetValue = feature?.properties?.[table.targetField];
            if (!targetValue) return [];

            const rows = dataMap.get(String(targetValue)) || [];

            // Format like the original hook does - add labelValuePairs
            return rows.map(row => {
                if (table.displayFields) {
                    const labelValuePairs = table.displayFields.map(df => {
                        const rawValue = row[df.field];
                        // Apply format first (number/currency), then transform if exists
                        const formattedValue = formatNumeric(rawValue, df.format);
                        const finalValue = df.transform ? df.transform(formattedValue, row, rows) : formattedValue;
                        return {
                            label: df.label,
                            value: finalValue || 'N/A'
                        };
                    });
                    return { ...row, labelValuePairs };
                }
                return row;
            });
        });
    }, [bulkRelatedData, relatedTables, feature?.properties]);

    // Hooks must run before any early return — keep these above the raster/no-feature guards.
    const properties = useMemo(() => feature?.properties || {}, [feature]);
    const galleryImages = useMemo(
        () => buildGalleryImages(imageFields, properties, relatedTables, data),
        [imageFields, properties, relatedTables, data]
    );

    const rasterValue = getRasterFeatureValue(rasterSource);

    // Build the ordered list of render items. relatedTablesPosition decides whether related
    // tables sit before or after the feature fields — expressed as list composition, not sort keys.
    const orderedItems = useMemo<PopupItem[]>(() => {
        const fieldItems = buildFeatureFieldItems({ properties, popupFields, rasterSource, rasterValue, colorCodingMap, colorCodingMode, linkFields });
        const relatedItems = buildRelatedTableItems({ relatedTables, data, properties });
        const tableItems = buildFieldsTableItems({ popupFieldsTable, properties });
        return relatedTablesPosition === 'above'
            ? [...relatedItems, ...fieldItems, ...tableItems]
            : [...fieldItems, ...relatedItems, ...tableItems];
    }, [properties, popupFields, rasterSource, rasterValue, colorCodingMap, colorCodingMode, linkFields, relatedTables, data, popupFieldsTable, relatedTablesPosition]);

    // Handle Raster-Only Display
    if (!feature && rasterValue !== null && rasterSource !== undefined) {
        const displayValue = rasterSource.transform
            ? rasterSource.transform(rasterValue)
            : String(rasterValue ?? 'N/A');

        return (
            <div className="space-y-4">
                <div className="flex flex-col">
                    <p className="font-bold underline text-foreground">{rasterSource.valueLabel}</p>
                    <p className="break-words text-foreground/80">{displayValue}</p>
                </div>
            </div>
        );
    }

    if (!feature) return null;

    const regularCount = orderedItems.filter(item => !item.isLong).length;
    const useGridLayout = layout === "grid" || regularCount > 5;

    const galleryId = properties?.id ?? properties?.pk ?? properties?.ogc_fid ?? feature?.id ?? 'photos'
    const galleryDownloadName = `${sanitizeFilename(`${layer.layerTitle ?? 'feature'}-${galleryId}`)}-photos.zip`

    return (
        <div className="space-y-2">
            {galleryImages.length > 0 && <PopupImageGallery images={galleryImages} downloadName={galleryDownloadName} />}
            <div className={useGridLayout ? "grid grid-cols-2 gap-2" : "space-y-2"}>
                {orderedItems.map((item, idx) =>
                    useGridLayout && item.isLong ? (
                        <div key={`full-width-${idx}`} className="col-span-full">{item.content}</div>
                    ) : (
                        item.content
                    )
                )}
            </div>
        </div>
    );
};

const PopupContentDisplay = memo(PopupContentDisplayInner, (prevProps, nextProps) => {
    // Compare feature by reference — feature.id is frequently undefined on
    // GeoJSON features, which would silently mask real changes.
    return (
        prevProps.feature === nextProps.feature &&
        prevProps.layout === nextProps.layout &&
        prevProps.layer.sourceCRS === nextProps.layer.sourceCRS &&
        prevProps.layer.layerTitle === nextProps.layer.layerTitle &&
        prevProps.bulkRelatedData === nextProps.bulkRelatedData
    );
});

PopupContentDisplay.displayName = 'PopupContentDisplay';

export { PopupContentDisplay };