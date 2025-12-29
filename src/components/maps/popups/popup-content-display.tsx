import { Button } from "@/components/ui/button";
import { RelatedDataMap, EMPTY_RELATED_DATA_MAP } from "@/hooks/use-bulk-related-table";
import { Feature, Geometry, GeoJsonProperties } from "geojson";
import { ExternalLink } from "lucide-react";
import { LayerContentProps } from "@/components/maps/popups/popup-content-with-pagination";
import { Link } from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumeric } from "@/lib/utils";
import { memo, useMemo, ReactNode } from "react";
import {
    FieldConfig,
    StringPopupFieldConfig,
    NumberPopupFieldConfig,
    CustomPopupFieldConfig,
    ProcessedRasterSource,
    LinkFields,
    ColorCodingRecordFunction,
    RelatedTable,
    LinkConfig,
    LinkDefinition
} from "@/lib/types/mapping-types";

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

// --- Type Guards ---
const isNumberField = (field: FieldConfig | undefined): field is NumberPopupFieldConfig =>
    !!field && field.type === 'number';

const isStringField = (field: FieldConfig | undefined): field is StringPopupFieldConfig =>
    !!field && field.type === 'string';

const isCustomField = (field: FieldConfig | undefined): field is CustomPopupFieldConfig =>
    !!field && field.type === 'custom';

// --- Utility Functions ---
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

const getRasterFeatureValue = (rasterSource: ProcessedRasterSource | undefined): number | null => {
    if (!rasterSource?.data?.features?.length) return null;
    const valueField = rasterSource.valueField;
    return rasterSource.data.features[0]?.properties?.[valueField];
};

const applyColor = (colorCodingMap: ColorCodingRecordFunction | undefined, fieldKey: string, value: string | number) => {
    if (colorCodingMap && colorCodingMap[fieldKey]) {
        const colorFunction = colorCodingMap[fieldKey];
        return { color: colorFunction(value) };
    }
    return {};
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

// --- Main Component ---
const PopupContentDisplayInner = ({ feature, layout, layer, bulkRelatedData }: PopupContentDisplayProps) => {
    const { relatedTables, popupFields, linkFields, colorCodingMap, rasterSource } = layer;

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
                        const finalValue = df.transform ? df.transform(formattedValue) : formattedValue;
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
                    <p className="font-bold underline text-primary">{rasterSource.valueLabel}</p>
                    <p className="break-words">{displayValue}</p>
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
        } else if (currentConfig && (isStringField(currentConfig) || isNumberField(currentConfig))) {
            const rawValue = popupFields ? properties[currentConfig.field] : valueFromPropertiesDirectly;
            finalDisplayValue = processFieldValue(currentConfig, rawValue);
        } else {
            finalDisplayValue = String(entryData ?? '');
        }

        if (!shouldDisplayValue(finalDisplayValue)) {
            return;
        }

        const content = (
            <div key={`feature-item-${label}-${index}`} className="flex flex-col" style={applyColor(colorCodingMap, fieldKey, finalDisplayValue)}>
                <p className="font-bold underline text-primary">{label}</p>
                <div className="break-words">
                    {renderFieldContent(finalDisplayValue, fieldKey, properties, linkFields, urlPattern)}
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

        // Use explicit displayAs config (defaults to 'list')
        const useTableFormat = table.displayAs === 'table' && !!table.displayFields && table.displayFields.length > 0;

        let relatedContent: JSX.Element;

        if (useTableFormat) {
            // Get column headers from displayFields
            const headers = table.displayFields!.map(df => df.label || df.field);

            relatedContent = (
                <div key={`related-${table.fieldLabel}-${tableIndex}`} className="flex flex-col space-y-2">
                    <p className="font-bold underline text-primary">
                        {properties[table.fieldLabel] || table.fieldLabel}
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {headers.map((header, idx) => (
                                    <TableHead key={idx} className="h-8 text-xs">
                                        {header}
                                    </TableHead>
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
                </div>
            );
        } else {
            // Original simple format for single values or description-only fields
            relatedContent = (
                <div key={`related-${table.fieldLabel}-${tableIndex}`} className="flex flex-col space-y-2">
                    <p className="font-bold underline text-primary">
                        {properties[table.fieldLabel] || table.fieldLabel}
                    </p>
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
                </div>
            );
        }

        const totalWords = flatValues.map(v => String(v.value)).join(" ").split(/\s+/).length;
        const isLongContent = !useTableFormat && (totalWords > 20 || flatValues.length > 3);
        contentItems.push({ content: relatedContent, isLongContent, originalIndex: 1000 + tableIndex });
    });

    // --- Layout Rendering ---
    const longContent = contentItems.filter(item => item.isLongContent).sort((a, b) => a.originalIndex - b.originalIndex).map(item => item.content);
    const regularContent = contentItems.filter(item => !item.isLongContent).sort((a, b) => a.originalIndex - b.originalIndex).map(item => item.content);
    const useGridLayout = layout === "grid" || regularContent.length > 5;

    return (
        <div className="space-y-2">
            {longContent.length > 0 && <div className="space-y-2 col-span-full">{longContent}</div>}
            <div className={useGridLayout ? "grid grid-cols-2 gap-2" : "space-y-2"}>{regularContent}</div>
        </div>
    );
};

const PopupContentDisplay = memo(PopupContentDisplayInner, (prevProps, nextProps) => {
    return (
        prevProps.feature?.id === nextProps.feature?.id &&
        prevProps.layout === nextProps.layout &&
        prevProps.layer.sourceCRS === nextProps.layer.sourceCRS &&
        prevProps.layer.layerTitle === nextProps.layer.layerTitle &&
        prevProps.bulkRelatedData === nextProps.bulkRelatedData
    );
});

PopupContentDisplay.displayName = 'PopupContentDisplay';

export { PopupContentDisplay };