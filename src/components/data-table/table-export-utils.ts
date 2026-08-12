import { isValidElement } from 'react';
import type { RelatedTable, FieldConfig } from '@/lib/types/mapping-types';
import type { RelatedDataMap } from '@/hooks/use-bulk-related-table';
import { buildCSV, downloadBytes, downloadCsvString, downloadGeoJSON, downloadZip, geojsonToWKT } from '@/lib/download-utils';
import { isInternalColumn } from '@/lib/export-fields';
import { formatFieldValue } from '@/lib/field-formatting';
import { formatNumeric } from '@/lib/utils';
import type { RowData, ColumnConfig } from './types';

interface MainColumn {
    field: string;
    label: string;
    fieldConfig?: FieldConfig;
}

/** Formats the table can emit. The gdal ones go through gdal3.js, same as parquet downloads. */
export type TableExportFormat = 'csv' | 'geojson' | 'gpkg' | 'shp' | 'gdb' | 'fgb';

export interface TableExportParams {
    format: TableExportFormat;
    dataToExport: RowData[];
    layerTitle: string;
    columnConfigs: ColumnConfig[];
    relatedTables: RelatedTable[];
    relatedDataMaps: RelatedDataMap[];
    /** When false, related table data is dropped — single CSV with main features only. */
    includeRelated: boolean;
}

function safeName(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'related';
}

// Union of all property keys across rows, merged with configured labels/formatting.
// Configured (popupField) columns come first in their declared order; remaining raw
// property keys are appended alphabetically. Warehouse bookkeeping keys are dropped —
// the same list the parquet downloads use, so both agree on a dataset's fields.
function buildMainColumns(data: RowData[], columnConfigs: ColumnConfig[]): MainColumn[] {
    const cols: MainColumn[] = [];
    const seen = new Set<string>();

    for (const cfg of columnConfigs) {
        if (cfg.fieldConfig?.type === 'custom') continue;
        if (seen.has(cfg.field)) continue;
        if (isInternalColumn(cfg.field)) continue;
        seen.add(cfg.field);
        cols.push({ field: cfg.field, label: cfg.label, fieldConfig: cfg.fieldConfig });
    }

    const extras: string[] = [];
    for (const row of data) {
        for (const key of Object.keys(row.properties)) {
            if (seen.has(key)) continue;
            if (isInternalColumn(key)) continue;
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
    } else if (format === 'geojson') {
        exportAsGeoJSON(dataToExport, filename, mainColumns, effectiveRelated, effectiveDataMaps);
    } else {
        // Fire and forget: gdal3.js loads lazily, so this resolves after the click.
        void exportViaGdal(format, dataToExport, filename, mainColumns, effectiveRelated, effectiveDataMaps);
    }
}

/**
 * GPKG / SHP / GDB / FGB via gdal3.js. Flat formats can't hold the nested `related`
 * object the GeoJSON export uses, so related rows ride along as sibling CSVs in a zip.
 */
async function exportViaGdal(
    format: Exclude<TableExportFormat, 'csv' | 'geojson'>,
    dataToExport: RowData[],
    filename: string,
    mainColumns: MainColumn[],
    relatedTables: RelatedTable[],
    relatedDataMaps: RelatedDataMap[],
): Promise<void> {
    const fields = mainColumns.map(c => c.field);
    const features = dataToExport.map(row => {
        const properties: Record<string, unknown> = {};
        for (const field of fields) {
            if (field in row.properties) properties[field] = row.properties[field];
        }
        return { type: 'Feature' as const, geometry: row.feature.geometry, properties };
    });
    const geojson = JSON.stringify({ type: 'FeatureCollection', features });

    // No declared types here (unlike parquet), so a column counts as float only when some
    // value actually has a fractional part — otherwise GDAL reads it as Integer.
    const floatCols = fields.filter(field =>
        dataToExport.some(row => {
            const v = row.properties[field];
            return typeof v === 'number' && !Number.isInteger(v);
        }),
    );

    const { convertGeoJSON, GDAL_TARGETS } = await import('@/lib/gdal-export');
    const { bytes, filename: outName } = await convertGeoJSON(geojson, filename, GDAL_TARGETS[format], 4326, fields, floatCols);

    const relatedFiles: Record<string, string> = {};
    relatedTables.forEach((table, idx) => {
        const name = safeName(table.fieldLabel || `table-${idx + 1}`);
        relatedFiles[`related-${name}.csv`] = buildRelatedCsv(dataToExport, table, relatedDataMaps[idx]);
    });

    if (Object.keys(relatedFiles).length === 0) {
        downloadBytes(bytes, outName);
        return;
    }
    downloadZip({ [outName]: bytes, ...relatedFiles }, filename);
}

const FEATURE_KEY_HEADER = '_feature_key';

function buildMainCsv(dataToExport: RowData[], mainColumns: MainColumn[], relatedTables: RelatedTable[]): string {
    const headers = [...mainColumns.map(c => c.label), 'geometry'];
    // Append a feature_key column when related tables exist so per-table CSVs can join back.
    if (relatedTables.length > 0) headers.push(FEATURE_KEY_HEADER);

    return buildCSV(dataToExport, headers, (row, header) => {
        if (header === 'geometry') {
            return geojsonToWKT(row.feature.geometry as Parameters<typeof geojsonToWKT>[0]) || '';
        }
        if (header === FEATURE_KEY_HEADER) {
            return featureKey(row, relatedTables);
        }
        const col = mainColumns.find(c => c.label === header);
        if (!col) return '';
        const rawValue = row.properties[col.field];
        if (col.fieldConfig) return formatFieldValue(col.fieldConfig, rawValue, row.properties);
        return rawValue ?? '';
    });
}

function buildRelatedCsv(
    dataToExport: RowData[],
    table: RelatedTable,
    dataMap: RelatedDataMap | undefined,
): string {
    const displayFields = table.displayFields || [];
    const headers = [FEATURE_KEY_HEADER, ...displayFields.map(df => df.label || df.field)];

    const rows: { key: string; record: Record<string, unknown> }[] = [];
    for (const row of dataToExport) {
        const targetValue = String(row.properties[table.targetField!] ?? '');
        const records = dataMap?.get(targetValue) || [];
        const key = String(row.properties[table.targetField!] ?? row.feature.id ?? '');
        for (const record of records) {
            rows.push({ key, record });
        }
    }

    return buildCSV(rows, headers, (row, header) => {
        if (header === FEATURE_KEY_HEADER) return row.key;
        const df = displayFields.find(d => (d.label || d.field) === header);
        if (!df) return '';
        const raw = row.record[df.field];
        const formatted = formatNumeric(raw, df.format);
        if (df.transform) {
            const result = df.transform(formatted);
            if (isValidElement(result)) {
                const props = result.props as { to?: string; href?: string };
                return props.to || props.href || formatted;
            }
            return result;
        }
        return formatted;
    });
}

/**
 * Pick a stable key per feature so per-table CSVs can rejoin to main.
 * Prefers the targetField of the first related table (since that's what the
 * related tables themselves index by). Falls back to feature id.
 */
function featureKey(row: RowData, relatedTables: RelatedTable[]): string {
    const target = relatedTables[0]?.targetField;
    if (target && row.properties[target] != null) return String(row.properties[target]);
    return String(row.feature.id ?? '');
}

function exportAsCSV(
    dataToExport: RowData[],
    filename: string,
    mainColumns: MainColumn[],
    relatedTables: RelatedTable[],
    relatedDataMaps: RelatedDataMap[],
): void {
    const mainCsv = buildMainCsv(dataToExport, mainColumns, relatedTables);

    if (relatedTables.length === 0) {
        downloadCsvString(mainCsv, filename);
        return;
    }

    const files: Record<string, string> = { 'main.csv': mainCsv };
    relatedTables.forEach((table, idx) => {
        const name = safeName(table.fieldLabel || `table-${idx + 1}`);
        files[`related-${name}.csv`] = buildRelatedCsv(dataToExport, table, relatedDataMaps[idx]);
    });
    downloadZip(files, filename);
}

function exportAsGeoJSON(
    dataToExport: RowData[],
    filename: string,
    mainColumns: MainColumn[],
    relatedTables: RelatedTable[],
    relatedDataMaps: RelatedDataMap[],
): void {
    const includedFields = new Set(mainColumns.map(c => c.field));
    const geoData = dataToExport.map(row => {
        const filtered: Record<string, unknown> = {};
        for (const field of includedFields) {
            if (field in row.properties) filtered[field] = row.properties[field];
        }
        if (relatedTables.length > 0) {
            const related: Record<string, Record<string, unknown>[]> = {};
            relatedTables.forEach((table, idx) => {
                const targetValue = String(row.properties[table.targetField!] ?? '');
                const records = relatedDataMaps[idx]?.get(targetValue) || [];
                const key = table.fieldLabel || `table-${idx + 1}`;
                related[key] = records;
            });
            filtered.related = related;
        }
        filtered.geometry = row.feature.geometry;
        return filtered;
    });
    downloadGeoJSON(geoData, filename, { geometryKey: 'geometry' });
}
