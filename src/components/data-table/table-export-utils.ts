import { isValidElement } from 'react';
import type { RelatedTable, FieldConfig } from '@/lib/types/mapping-types';
import type { RelatedDataMap } from '@/hooks/use-bulk-related-table';
import { downloadCSV, downloadGeoJSON, geojsonToWKT } from '@/lib/download-utils';
import { formatFieldValue } from '@/lib/field-formatting';
import { formatNumeric } from '@/lib/utils';
import type { RowData, ColumnConfig } from './types';

interface ExportRow {
    feature: RowData;
    relatedRecord: Record<string, unknown> | null;
    relatedTableIndex: number | null;
}

interface MainColumn {
    field: string;
    label: string;
    fieldConfig?: FieldConfig;
}

export interface TableExportParams {
    format: 'csv' | 'geojson';
    dataToExport: RowData[];
    layerTitle: string;
    columnConfigs: ColumnConfig[];
    relatedTables: RelatedTable[];
    relatedDataMaps: RelatedDataMap[];
    /** When false, related table data is dropped — emits one CSV row per feature. */
    includeRelated: boolean;
}

// Empty-string fieldLabel is intentional ("no prefix"). Only undefined gets the default.
function relatedHeaderPrefix(fieldLabel: string | undefined): string {
    if (fieldLabel === undefined) return 'Related: ';
    if (fieldLabel === '') return '';
    return `${fieldLabel}: `;
}

// Union of all property keys across rows, merged with configured labels/formatting.
// Configured (popupField) columns come first in their declared order; remaining raw
// property keys are appended alphabetically. Internal/_-prefixed keys are dropped.
function buildMainColumns(data: RowData[], columnConfigs: ColumnConfig[]): MainColumn[] {
    const cols: MainColumn[] = [];
    const seen = new Set<string>();

    for (const cfg of columnConfigs) {
        if (cfg.fieldConfig?.type === 'custom') continue;
        if (seen.has(cfg.field)) continue;
        seen.add(cfg.field);
        cols.push({ field: cfg.field, label: cfg.label, fieldConfig: cfg.fieldConfig });
    }

    const extras: string[] = [];
    for (const row of data) {
        for (const key of Object.keys(row.properties)) {
            if (seen.has(key)) continue;
            if (key === 'geometry' || key === 'bbox' || key.startsWith('_')) continue;
            seen.add(key);
            extras.push(key);
        }
    }
    extras.sort();
    for (const key of extras) {
        cols.push({ field: key, label: key });
    }

    return cols;
}

export function exportTableData({
    format,
    dataToExport,
    layerTitle,
    columnConfigs,
    relatedTables,
    relatedDataMaps,
    includeRelated,
}: TableExportParams): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const layerName = (layerTitle || 'export').replace(/\s+/g, '-').toLowerCase();
    const filename = `${layerName}-${timestamp}`;
    const mainColumns = buildMainColumns(dataToExport, columnConfigs);
    const effectiveRelated = includeRelated ? relatedTables : [];
    const effectiveDataMaps = includeRelated ? relatedDataMaps : [];

    if (format === 'csv') {
        exportAsCSV(dataToExport, filename, mainColumns, effectiveRelated, effectiveDataMaps);
    } else {
        exportAsGeoJSON(dataToExport, filename, mainColumns);
    }
}

function exportAsCSV(
    dataToExport: RowData[],
    filename: string,
    mainColumns: MainColumn[],
    relatedTables: RelatedTable[],
    relatedDataMaps: RelatedDataMap[],
): void {
    const mainHeaders = mainColumns.map(c => c.label);
    const columnByLabel = new Map(mainColumns.map(c => [c.label, c]));
    const relatedHeaders: string[] = [];

    relatedTables.forEach((table) => {
        const prefix = relatedHeaderPrefix(table.fieldLabel);
        table.displayFields?.forEach(df => {
            relatedHeaders.push(`${prefix}${df.label || df.field}`);
        });
    });

    const allHeaders = [...mainHeaders, ...relatedHeaders, 'geometry'];

    // Denormalized: one row per related record (or one row when no related data).
    // Easier for downstream tools (Excel, pandas, QGIS) to filter/group than `; `-joined cells.
    const expandedRows: ExportRow[] = [];

    for (const row of dataToExport) {
        const allRelatedRecords: { record: Record<string, unknown>; tableIndex: number }[] = [];

        relatedTables.forEach((table, tableIndex) => {
            const targetValue = String(row.properties[table.targetField] ?? '');
            const dataMap = relatedDataMaps[tableIndex];
            const records = dataMap?.get(targetValue) || [];
            records.forEach(record => {
                allRelatedRecords.push({ record, tableIndex });
            });
        });

        if (allRelatedRecords.length === 0) {
            expandedRows.push({ feature: row, relatedRecord: null, relatedTableIndex: null });
        } else {
            for (const { record, tableIndex } of allRelatedRecords) {
                expandedRows.push({ feature: row, relatedRecord: record, relatedTableIndex: tableIndex });
            }
        }
    }

    downloadCSV(expandedRows, filename, allHeaders, (exportRow, header) => {
        const { feature: row, relatedRecord, relatedTableIndex } = exportRow;

        if (header === 'geometry') {
            return geojsonToWKT(row.feature.geometry as Parameters<typeof geojsonToWKT>[0]) || '';
        }

        const mainCol = columnByLabel.get(header);
        if (mainCol) {
            const rawValue = row.properties[mainCol.field];
            if (mainCol.fieldConfig) {
                return formatFieldValue(mainCol.fieldConfig, rawValue, row.properties);
            }
            return rawValue ?? '';
        }

        for (let tableIndex = 0; tableIndex < relatedTables.length; tableIndex++) {
            const table = relatedTables[tableIndex];
            const prefix = relatedHeaderPrefix(table.fieldLabel);

            const displayField = table.displayFields?.find(
                df => `${prefix}${df.label || df.field}` === header
            );

            if (displayField) {
                if (relatedRecord && relatedTableIndex === tableIndex) {
                    const raw = relatedRecord[displayField.field];
                    const formatted = formatNumeric(raw, displayField.format);
                    if (displayField.transform) {
                        const result = displayField.transform(formatted);
                        if (isValidElement(result)) {
                            const props = result.props as { to?: string; href?: string };
                            return props.to || props.href || formatted;
                        }
                        return result;
                    }
                    return formatted;
                }
                return '';
            }
        }

        return '';
    });
}

function exportAsGeoJSON(
    dataToExport: RowData[],
    filename: string,
    mainColumns: MainColumn[],
): void {
    const includedFields = new Set(mainColumns.map(c => c.field));
    const geoData = dataToExport.map(row => {
        const filtered: Record<string, unknown> = {};
        for (const field of includedFields) {
            if (field in row.properties) filtered[field] = row.properties[field];
        }
        filtered.geometry = row.feature.geometry;
        return filtered;
    });
    downloadGeoJSON(geoData, filename, { geometryKey: 'geometry' });
}
