import { isValidElement } from 'react';
import type { RelatedTable } from '@/lib/types/mapping-types';
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

export interface TableExportParams {
    format: 'csv' | 'geojson';
    dataToExport: RowData[];
    layerTitle: string;
    visibleConfigs: ColumnConfig[];
    relatedTables: RelatedTable[];
    relatedDataMaps: RelatedDataMap[];
}

export function exportTableData({
    format,
    dataToExport,
    layerTitle,
    visibleConfigs,
    relatedTables,
    relatedDataMaps,
}: TableExportParams): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const layerName = (layerTitle || 'export').replace(/\s+/g, '-').toLowerCase();
    const filename = `${layerName}-${timestamp}`;

    if (format === 'csv') {
        exportAsCSV(dataToExport, filename, visibleConfigs, relatedTables, relatedDataMaps);
    } else {
        exportAsGeoJSON(dataToExport, filename, visibleConfigs);
    }
}

function exportAsCSV(
    dataToExport: RowData[],
    filename: string,
    visibleConfigs: ColumnConfig[],
    relatedTables: RelatedTable[],
    relatedDataMaps: RelatedDataMap[],
): void {
    // Build headers: visible columns + related table columns + geometry
    const mainHeaders = visibleConfigs.map(c => c.label);
    const relatedHeaders: string[] = [];

    relatedTables.forEach((table) => {
        const prefix = `${table.fieldLabel || 'Related'}: `;
        table.displayFields?.forEach(df => {
            relatedHeaders.push(`${prefix}${df.label || df.field}`);
        });
    });

    const allHeaders = [...mainHeaders, ...relatedHeaders, 'geometry'];

    // Build denormalized rows: one row per related record (or one row if no related data)
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

        // Check main columns
        const config = visibleConfigs.find(c => c.label === header);
        if (config) {
            const rawValue = row.properties[config.field];
            return formatFieldValue(config.fieldConfig, rawValue, row.properties);
        }

        // Check related tables
        for (let tableIndex = 0; tableIndex < relatedTables.length; tableIndex++) {
            const table = relatedTables[tableIndex];
            const prefix = `${table.fieldLabel || 'Related'}: `;

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
    visibleConfigs: ColumnConfig[],
): void {
    const visibleFields = new Set(visibleConfigs.map(c => c.field));
    const geoData = dataToExport.map(row => {
        const filtered: Record<string, unknown> = {};
        for (const field of visibleFields) {
            if (field in row.properties) filtered[field] = row.properties[field];
        }
        filtered.geometry = row.feature.geometry;
        return filtered;
    });
    downloadGeoJSON(geoData, filename, { geometryKey: 'geometry' });
}
