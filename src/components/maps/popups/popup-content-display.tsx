import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/lib/types/mapping-types";
import { PopupImageGallery, type GalleryImage } from "@/components/maps/popups/popup-image-gallery";
import { relatedRowToGalleryImage } from "@/lib/gallery-utils";
import { sanitizeFilename } from "@/lib/download-utils";
import { Accordion, AccordionItem, AccordionContent, AccordionTrigger } from "@/components/ui/accordion";
import {
    isNumberField,
    isStringField,
    isDateField,
    isCustomField,
    formatFieldValue,
} from "@/lib/field-formatting";

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
    /** True while the bulk related-table fetch is in flight — show skeletons in place of tables. */
    relatedLoading?: boolean;
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

    const targetField = properties?.[table.targetField!];
    const tableData = data[groupedLayerIndex];

    if (!tableData) return [[{ label: "", value: "No data available" }]];

    // Each matching item becomes its own row (array of labelValuePairs)
    const tableMatches = tableData
        .filter(item =>
            String(item[table.matchingField!]) === String(targetField) &&
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

export interface AccordionEntry {
    key: string;
    label: string;
    href?: string;
    notes?: string;
}

// One collapsible entry per row, for the 'accordion' displayAs. encodeURI, NOT
// encodeURIComponent: the path's slashes have to survive while spaces in filenames are escaped —
// encodeURIComponent turns the separators into %2F and 404s the link.
export function buildAccordionEntries(
    table: RelatedTable,
    rows: Record<string, unknown>[]
): AccordionEntry[] {
    if (table.displayAs !== 'accordion') return []
    const base = table.itemBaseUrl
    return rows.map((row, i) => {
        const path = row.gcs_path ? String(row.gcs_path) : ''
        const notes = row.notes ? String(row.notes).trim() : ''
        return {
            key: String(row.pk ?? i),
            label: String(row.filename ?? 'Document'),
            href: base && path ? encodeURI(`${base}/${path}`) : undefined,
            notes: notes || undefined,
        }
    })
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

// --- Main Component ---
const PopupContentDisplayInner = ({ feature, layout, layer, bulkRelatedData, relatedLoading }: PopupContentDisplayProps) => {
    const { relatedTables, relatedTablesPosition, popupFields, linkFields, imageFields, colorCodingMap, colorCodingMode, rasterSource } = layer;

    // Convert bulk data to the format expected by getRelatedTableValues
    const data = useMemo((): ProcessedRelatedData[][] => {
        if (!bulkRelatedData || !relatedTables) {
            return [];
        }

        // Convert bulk RelatedDataMap to ProcessedRelatedData format
        return relatedTables.map((table, tableIndex) => {
            const dataMap = bulkRelatedData[tableIndex] || EMPTY_RELATED_DATA_MAP;
            const targetValue = feature?.properties?.[table.targetField!];
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

    const urlPattern = /https?:\/\/[^\s/$.?#].[^\s]*/;

    type PropertyValue = string | number | boolean | null | undefined;

    const isFieldConfig = (value: FieldConfig | PropertyValue): value is FieldConfig => {
        return typeof value === 'object' && value !== null && 'type' in value && 'field' in value;
    };

    const mappedFeatureEntries = popupFields
        ? Object.entries(popupFields)
        : Object.entries(properties);

    if (rasterValue !== null && rasterSource?.valueLabel) {
        mappedFeatureEntries.push([rasterSource.valueLabel, rasterValue]);
    }

    const contentItems: { content: JSX.Element; isLongContent: boolean; originalIndex: number; }[] = [];

    mappedFeatureEntries.forEach(([label, entryData], index) => {
        let currentConfig: FieldConfig | undefined = undefined;
        let isRasterEntry = false;
        let valueFromPropertiesDirectly: PropertyValue = undefined;

        if (label === rasterSource?.valueLabel && entryData === rasterValue) {
            isRasterEntry = true;
        } else if (isFieldConfig(entryData)) {
            currentConfig = entryData;
        } else {
            valueFromPropertiesDirectly = entryData;
            currentConfig = { field: label, type: 'string', label } as StringPopupFieldConfig;
        }

        let finalDisplayValue: string;
        const fieldKey = currentConfig?.field || label;

        if (isRasterEntry) {
            finalDisplayValue = rasterSource?.transform && rasterValue !== null
                ? rasterSource.transform(rasterValue) || ''
                : String(rasterValue ?? '');
        } else if (currentConfig && isCustomField(currentConfig)) {
            finalDisplayValue = currentConfig.transform?.(properties)?.toString() || '';
        } else if (currentConfig && isDateField(currentConfig)) {
            const rawValue = popupFields ? properties[currentConfig.field] : valueFromPropertiesDirectly;
            finalDisplayValue = formatFieldValue(currentConfig, rawValue, properties);
        } else if (currentConfig && (isStringField(currentConfig) || isNumberField(currentConfig))) {
            const rawValue = popupFields ? properties[currentConfig.field] : valueFromPropertiesDirectly;
            finalDisplayValue = formatFieldValue(currentConfig, rawValue, properties);
        } else {
            finalDisplayValue = String(entryData ?? '');
        }

        if (!shouldDisplayValue(finalDisplayValue)) {
            return;
        }

        const colorStyle = getColorStyle(colorCodingMap, colorCodingMode, fieldKey, finalDisplayValue);
        const hasColorStyling = colorStyle.className || Object.keys(colorStyle.style).length > 0;
        const description = currentConfig?.description;
        const labelContent = description ? (
            <TooltipProvider delayDuration={200}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1">{label}<Info className="h-3.5 w-3.5 text-muted-foreground" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-64 text-xs">
                        {description}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        ) : label;
        const content = (
            <div key={`feature-item-${label}-${index}`} className="flex flex-col">
                <p className="font-bold underline text-foreground">{labelContent}</p>
                <div className="break-words text-foreground/80">
                    {hasColorStyling ? (
                        <span className={colorStyle.className} style={colorStyle.style}>
                            {renderFieldContent(finalDisplayValue, fieldKey, properties, linkFields, urlPattern)}
                        </span>
                    ) : (
                        renderFieldContent(finalDisplayValue, fieldKey, properties, linkFields, urlPattern)
                    )}
                </div>
            </div>
        );

        const isLongContent = String(finalDisplayValue).split(/\s+/).length > 20;
        contentItems.push({ content, isLongContent, originalIndex: index });
    });

    // Handle Related Tables
    (relatedTables || []).forEach((table, tableIndex) => {
        const groupedValues = getRelatedTableValues(tableIndex, data, relatedTables, properties);
        const flatValues = groupedValues.flat();

        // Skip rendering if no real data (only "No data available" placeholder).
        const hasRealData = flatValues.some(v => v.value !== "No data available");
        if (!hasRealData) {
            // While the bulk related fetch is in flight, show a labeled skeleton in place of the
            // table so the popup signals "loading" instead of the section silently popping in.
            if (relatedLoading) {
                const loadingLabel = String(properties[table.fieldLabel] || table.fieldLabel);
                const relatedIndex = (relatedTablesPosition === 'above' ? -1000 : 1000) + tableIndex;
                contentItems.push({
                    content: (
                        <div key={`related-loading-${table.fieldLabel}-${tableIndex}`} className="flex flex-col gap-1.5">
                            <p className="font-bold underline text-foreground">{loadingLabel}</p>
                            <div className="space-y-1.5 py-1">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                        </div>
                    ),
                    isLongContent: true,
                    originalIndex: relatedIndex,
                });
            }
            return;
        }

        // Use explicit displayAs config (defaults to 'list')
        const useTableFormat = table.displayAs === 'table' && !!table.displayFields && table.displayFields.length > 0;

        const sectionLabel = String(properties[table.fieldLabel] || table.fieldLabel);
        const collapsible = table.collapsible ?? sectionLabel.trim() !== '';

        let innerContent: JSX.Element;

        if (table.displayAs === 'accordion') {
            const docs = buildAccordionEntries(table, (data[tableIndex] ?? []) as Record<string, unknown>[]);
            innerContent = (
                <Accordion type="multiple" className="space-y-1">
                    {docs.map(doc => (
                        <AccordionItem key={doc.key} value={doc.key} className="border rounded px-2">
                            <AccordionTrigger className="py-1.5 text-xs">{doc.label}</AccordionTrigger>
                            <AccordionContent className="text-xs space-y-1">
                                {doc.notes && <p className="text-muted-foreground">{doc.notes}</p>}
                                {doc.href
                                    ? <a href={doc.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline decoration-1">Open / download <ExternalLink size={12} /></a>
                                    : <p className="text-muted-foreground italic">No file link</p>}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            );
        } else if (useTableFormat) {
            // Sortable: raw rows + column defs (TanStack) so sorting is numeric/
            // alphabetical on the underlying values, not the rendered cells.
            innerContent = (
                <RelatedDataTable
                    rows={data[tableIndex] as Record<string, unknown>[]}
                    displayFields={table.displayFields!}
                    initialSort={table.sortBy ? { id: table.sortBy, desc: table.sortDirection === 'desc' } : undefined}
                />
            );
        } else {
            innerContent = (
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
        }

        const relatedContent = collapsible ? (
            <CollapsibleSection key={`related-${table.fieldLabel}-${tableIndex}`} label={sectionLabel} count={groupedValues.length}>
                {innerContent}
            </CollapsibleSection>
        ) : (
            <InlineSection key={`related-${table.fieldLabel}-${tableIndex}`} label={sectionLabel || undefined}>
                {innerContent}
            </InlineSection>
        );

        const totalWords = flatValues.map(v => String(v.value)).join(" ").split(/\s+/).length;
        const isLongContent = useTableFormat || table.displayAs === 'accordion' || totalWords > 20 || flatValues.length > 3;
        // 'above' sorts related tables before the feature fields (which start at 0); 'below' (default) after them.
        const relatedIndex = (relatedTablesPosition === 'above' ? -1000 : 1000) + tableIndex;
        contentItems.push({ content: relatedContent, isLongContent, originalIndex: relatedIndex });
    });

    // Handle Popup Fields Tables (collapsible dropdown tables for subsets of popupFields).
    // Pivoted layout: one row per field (Measurement | Value) so wide field sets don't scroll sideways.
    (layer.popupFieldsTable || []).forEach((tableConfig, tableIndex) => {
        const rows = tableConfig.fields
            .map((field) => {
                const value = formatFieldValue(field.config, properties[field.config.field], properties);
                return { label: field.label, value, unit: field.unit };
            })
            .filter(row => shouldDisplayValue(row.value))
            .map(row => [
                <span className="font-medium">{row.label}</span>,
                row.unit ? `${row.value} ${row.unit}` : row.value,
            ]);

        if (rows.length === 0) return;

        const headers = (tableConfig.labelHeader || tableConfig.valueHeader)
            ? [tableConfig.labelHeader, tableConfig.valueHeader]
            : undefined;

        const tableContent = (
            <CollapsibleSection
                key={`popup-fields-table-${tableIndex}`}
                label={tableConfig.sectionLabel}
                count={rows.length}
            >
                <PopupTable headers={headers} rows={rows} />
            </CollapsibleSection>
        );

        contentItems.push({
            content: tableContent,
            isLongContent: true,
            originalIndex: 2000 + tableIndex,
        });
    });

    // --- Layout Rendering ---
    // Render every item in config order (feature fields, then related tables, then popup
    // tables). Full-width items (tables, long text) span all columns inline at their
    // position rather than being hoisted to the top.
    const orderedItems = contentItems.sort((a, b) => a.originalIndex - b.originalIndex);
    const regularCount = orderedItems.filter(item => !item.isLongContent).length;
    const useGridLayout = layout === "grid" || regularCount > 5;

    const galleryId = properties?.id ?? properties?.pk ?? properties?.ogc_fid ?? feature?.id ?? 'photos'
    const galleryDownloadName = `${sanitizeFilename(`${layer.layerTitle ?? 'feature'}-${galleryId}`)}-photos.zip`

    return (
        <div className="space-y-2">
            {galleryImages.length > 0 && <PopupImageGallery images={galleryImages} downloadName={galleryDownloadName} />}
            <div className={useGridLayout ? "grid grid-cols-2 gap-2" : "space-y-2"}>
                {orderedItems.map((item, idx) =>
                    useGridLayout && item.isLongContent ? (
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
        prevProps.bulkRelatedData === nextProps.bulkRelatedData &&
        prevProps.relatedLoading === nextProps.relatedLoading
    );
});

PopupContentDisplay.displayName = 'PopupContentDisplay';

export { PopupContentDisplay };