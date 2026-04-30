import { Button } from "@/components/ui/button";
import { RelatedDataMap, EMPTY_RELATED_DATA_MAP } from "@/hooks/use-bulk-related-table";
import { Feature, Geometry, GeoJsonProperties } from "geojson";
import { ChevronDown, ChevronRight, ExternalLink, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LayerContentProps } from "@/components/maps/popups/types";
import { Link } from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumeric } from "@/lib/utils";
import { memo, useMemo, useState, ReactNode } from "react";
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

function CollapsibleSection({ label, children }: { label: string; children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="flex flex-col space-y-2">
            <button
                onClick={() => setIsOpen(o => !o)}
                className="flex items-center gap-1 font-bold text-primary hover:text-primary/80 hover:bg-muted/50 rounded px-1 -ml-1 transition-colors w-full"
            >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                <span className="underline">{label}</span>
            </button>
            {isOpen && children}
        </div>
    );
}

// --- Main Component ---
const PopupContentDisplayInner = ({ feature, layout, layer, bulkRelatedData }: PopupContentDisplayProps) => {
    const { relatedTables, popupFields, linkFields, imageFields, colorCodingMap, colorCodingMode, rasterSource } = layer;

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

    const properties = feature.properties || {};
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

        // Skip rendering if no real data (only "No data available" placeholder)
        const hasRealData = flatValues.some(v => v.value !== "No data available");
        if (!hasRealData) return;

        // Use explicit displayAs config (defaults to 'list')
        const useTableFormat = table.displayAs === 'table' && !!table.displayFields && table.displayFields.length > 0;

        let relatedContent: JSX.Element;

        const sectionLabel = String(properties[table.fieldLabel] || table.fieldLabel);

        if (useTableFormat) {
            const headers = table.displayFields!.map(df => df.label || df.field);
            relatedContent = (
                <CollapsibleSection key={`related-${table.fieldLabel}-${tableIndex}`} label={sectionLabel}>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {headers.map((header, idx) => (
                                    <TableHead key={idx} className="h-8 text-xs">{header}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {groupedValues.map((group, groupIdx) => (
                                <TableRow key={`row-${groupIdx}`}>
                                    {group.map((valueItem, cellIdx) => (
                                        <TableCell key={`cell-${cellIdx}`} className="py-1.5 text-xs">
                                            {valueItem.value}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CollapsibleSection>
            );
        } else {
            relatedContent = (
                <CollapsibleSection key={`related-${table.fieldLabel}-${tableIndex}`} label={sectionLabel}>
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
                </CollapsibleSection>
            );
        }

        const totalWords = flatValues.map(v => String(v.value)).join(" ").split(/\s+/).length;
        const isLongContent = useTableFormat || totalWords > 20 || flatValues.length > 3;
        contentItems.push({ content: relatedContent, isLongContent, originalIndex: 1000 + tableIndex });
    });

    // --- Layout Rendering ---
    const longContent = contentItems.filter(item => item.isLongContent).sort((a, b) => a.originalIndex - b.originalIndex).map(item => item.content);
    const regularContent = contentItems.filter(item => !item.isLongContent).sort((a, b) => a.originalIndex - b.originalIndex).map(item => item.content);
    const useGridLayout = layout === "grid" || regularContent.length > 5;

    const galleryImages = useMemo(
        () => buildGalleryImages(imageFields, properties, relatedTables, data),
        [imageFields, properties, relatedTables, data]
    )

    return (
        <div className="space-y-2">
            {galleryImages.length > 0 && <PopupImageGallery images={galleryImages} />}
            {longContent.length > 0 && <div className="space-y-2 col-span-full">{longContent}</div>}
            <div className={useGridLayout ? "grid grid-cols-2 gap-2" : "space-y-2"}>{regularContent}</div>
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