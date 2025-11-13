import { Button } from "@/components/ui/button";
import { ProcessedRelatedData, useRelatedTable } from "@/hooks/use-related-table";
import { Feature, Geometry, GeoJsonProperties } from "geojson";
import { ExternalLink } from "lucide-react";
import { LayerContentProps } from "@/components/custom/popups/popup-content-with-pagination";
import { Link } from "@/components/custom/link";
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

type PopupContentDisplayProps = {
    layer: LayerContentProps;
    feature?: Feature<Geometry, GeoJsonProperties>;
    layout?: "grid" | "stacked";
};

interface LabelValuePair { label: string; value: string | number; }

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

const getRelatedTableValues = (groupedLayerIndex: number, data: ProcessedRelatedData[][], relatedTables: RelatedTable[] | undefined, properties: { [name: string]: any; }): LabelValuePair[][] => {
    if (!data?.length) return [[{ label: "", value: "No data available" }]];
    const groupedValues: LabelValuePair[][] = [];
    const table = relatedTables?.[groupedLayerIndex];
    if (!table) return [[{ label: "Invalid index", value: "Invalid index" }]];
    const targetField = properties[table.targetField];
    if (data[groupedLayerIndex]) {
        const tableMatches: LabelValuePair[] = [];
        (data[groupedLayerIndex] as any[]).forEach((item: any) => {
            if (String(item[table.matchingField]) === String(targetField) && item.labelValuePairs) {
                tableMatches.push(...item.labelValuePairs);
            }
        });
        if (tableMatches.length > 0) groupedValues.push(tableMatches);
    }
    return groupedValues.length ? groupedValues : [[{ label: "", value: "No data available" }]];
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
const PopupContentDisplay = ({ feature, layout, layer }: PopupContentDisplayProps) => {
    const { relatedTables, popupFields, linkFields, colorCodingMap, rasterSource } = layer;
    const { data, isLoading, error } = useRelatedTable(relatedTables || [], feature || null);

    const rasterValue = getRasterFeatureValue(rasterSource);

    if (isLoading) return <p>Loading...</p>;
    if (error) return <p>Error: {String(error)}</p>;

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

    const sourceEntries: Array<[string, any]> = popupFields
        ? Object.entries(popupFields)
        : Object.entries(properties);

    // Simplified mapping - No special 'custom' link check here.
    const mappedFeatureEntries = sourceEntries.map(([label, configOrValue]) => {
        return [label, configOrValue] as [string, any];
    });

    if (rasterValue !== null && rasterSource?.valueLabel) {
        mappedFeatureEntries.push([rasterSource.valueLabel, rasterValue]);
    }

    const contentItems: { content: JSX.Element; isLongContent: boolean; originalIndex: number; }[] = [];

    mappedFeatureEntries.forEach(([label, entryData], index) => {
        let currentConfig: FieldConfig | undefined = undefined;
        let isRasterEntry = false;
        let valueFromPropertiesDirectly: any = undefined;

        if (label === rasterSource?.valueLabel && entryData === rasterValue) {
            isRasterEntry = true;
        } else if (popupFields) {
            currentConfig = entryData as FieldConfig;
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
        const relatedContent = (
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
        const totalWords = groupedValues.flat().map(v => String(v.value)).join(" ").split(/\s+/).length;
        contentItems.push({ content: relatedContent, isLongContent: totalWords > 20, originalIndex: 1000 + tableIndex });
    });

    // --- Layout Rendering ---
    const longContent = contentItems.filter(item => item.isLongContent).sort((a, b) => a.originalIndex - b.originalIndex).map(item => item.content);
    const regularContent = contentItems.filter(item => !item.isLongContent).sort((a, b) => a.originalIndex - b.originalIndex).map(item => item.content);
    const useGridLayout = layout === "grid" || regularContent.length > 5;

    return (
        <div className="space-y-4">
            {longContent.length > 0 && <div className="space-y-4 col-span-full">{longContent}</div>}
            <div className={useGridLayout ? "grid grid-cols-2 gap-4" : "space-y-4"}>{regularContent}</div>
        </div>
    );
};

export { PopupContentDisplay };