import { isValidElement } from 'react';
import type { RelatedTable, FieldConfig } from '@/lib/types/mapping-types';
import type { RelatedDataMap } from '@/hooks/use-bulk-related-table';
import { downloadCSV, downloadGeoJSON, geojsonToWKT } from '@/lib/download-utils';
import { formatFieldValue } from '@/lib/field-formatting';
import { formatNumeric } from '@/lib/utils';
import type { RowData, ColumnConfig } from './types';

interface MainColumn {
    field: string;
    label: string;
    fieldConfig?: FieldConfig;
}

type DisplayField = NonNullable<RelatedTable['displayFields']>[number];

interface RelatedColumn {
    header: string;
    tableIndex: number;
    displayField: DisplayField;
}

export interface TableExportParams {
    format: 'csv' | 'geojson';
    dataToExport: RowData[];
    layerTitle: string;
    columnConfigs: ColumnConfig[];
    relatedTables: RelatedTable[];
    relatedDataMaps: RelatedDataMap[];
}

const RELATED_VALUE_SEPARATOR = '; ';

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

function buildRelatedColumns(relatedTables: RelatedTable[]): RelatedColumn[] {
    const cols: RelatedColumn[] = [];
    relatedTables.forEach((table, tableIndex) => {
        const prefix = relatedHeaderPrefix(table.fieldLabel);
        table.displayFields?.forEach(df => {
            cols.push({
                header: `${prefix}${df.label || df.field}`,
                tableIndex,
                displayField: df,
            });
        });
    });
    return cols;
}

function formatRelatedValue(record: Record<string, unknown>, df: DisplayField): string {
    const raw = record[df.field];
    const formatted = formatNumeric(raw, df.format);
    if (!df.transform) return formatted;
    const result = df.transform(formatted);
    if (isValidElement(result)) {
        const props = result.props as { to?: string; href?: string };
        return props.to || props.href || formatted;
    }
    return result == null ? '' : String(result);
}

export function exportTableData({
    format,
    dataToExport,
    layerTitle,
    columnConfigs,
    relatedTables,
    relatedDataMaps,
}: TableExportParams): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const layerName = (layerTitle || 'export').replace(/\s+/g, '-').toLowerCase();
    const filename = `${layerName}-${timestamp}`;
    const mainColumns = buildMainColumns(dataToExport, columnConfigs);

    if (format === 'csv') {
        exportAsCSV(dataToExport, filename, mainColumns, relatedTables, relatedDataMaps);
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
    const relatedColumns = buildRelatedColumns(relatedTables);
    const relatedByHeader = new Map(relatedColumns.map(c => [c.header, c]));
    const allHeaders = [...mainHeaders, ...relatedColumns.map(c => c.header), 'geometry'];

    downloadCSV(dataToExport, filename, allHeaders, (row, header) => {
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

        const relatedCol = relatedByHeader.get(header);
        if (relatedCol) {
            const table = relatedTables[relatedCol.tableIndex];
            const targetValue = String(row.properties[table.targetField] ?? '');
            const records = relatedDataMaps[relatedCol.tableIndex]?.get(targetValue) || [];
            return records
                .map(record => formatRelatedValue(record, relatedCol.displayField))
                .filter(v => v !== '')
                .join(RELATED_VALUE_SEPARATOR);
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
