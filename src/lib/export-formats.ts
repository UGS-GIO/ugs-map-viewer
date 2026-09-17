/**
 * Export format registry — single source of truth for labels, extensions,
 * capability requirements, and menu ordering. Add a format here and the
 * dropdown + handler dispatch both pick it up.
 */

import type { RelatedTable } from '@/lib/types/mapping-types';

export type ExportFormat = 'parquet' | 'geojson' | 'csv' | 'gpkg' | 'shp' | 'gdb' | 'fgb';

const columnPrefix = (label: string): string =>
    label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'related';

/** A projection name no other column has taken: the field, then label-prefixed, then numbered. */
export const uniqueColumnName = (field: string, label: string, taken: Set<string>): string => {
    let name = field;
    if (taken.has(name)) name = `${columnPrefix(label)}_${field}`;
    for (let n = 2; taken.has(name); n++) name = `${columnPrefix(label)}_${field}_${n}`;
    taken.add(name);
    return name;
};

/** The names merged tables will actually contribute, collisions resolved as the export resolves them. */
export const mergedColumnNames = (mainColumns: string[], tables: RelatedTable[]): string[] => {
    const taken = new Set(mainColumns);
    const names: string[] = [];
    for (const table of tables) {
        for (const { field } of table.displayFields ?? []) {
            if (!field) continue;
            names.push(uniqueColumnName(field, table.fieldLabel, taken));
        }
    }
    return names;
};

/** Merged into the exported file itself, rather than shipped as its own CSV. Parquet-backed only. */
export const isCombinedTable = (table: RelatedTable): boolean =>
    !!table.combineIntoExport && table.fetchMode === 'parquet'
    && !!table.url && !!table.matchingField && !!table.targetField;

/** Formats converted by gdal3.js rather than DuckDB — see `gdal-export.ts`. */
export const GDAL_FORMATS = ['gpkg', 'shp', 'gdb', 'fgb'] as const;
export const isGdalFormat = (f: ExportFormat): boolean =>
    (GDAL_FORMATS as readonly string[]).includes(f);

export interface ExportFormatMeta {
    /** Human-readable label for the menu */
    label: string;
    /** File extension (no dot) */
    extension: string;
    /** Blob MIME type */
    mimeType: string;
    /** Whether a geometry column must be present in the parquet */
    requiresGeometry: boolean;
    /** Optional short hint shown after the label (e.g. "native", ".fgb") */
    hint?: string;
}

/** Menu order follows this Record's insertion order. */
export const EXPORT_FORMATS: Record<ExportFormat, ExportFormatMeta> = {
    parquet: {
        label: 'GeoParquet',
        extension: 'parquet',
        mimeType: 'application/octet-stream',
        requiresGeometry: false,
        hint: 'native',
    },
    geojson: {
        label: 'GeoJSON',
        extension: 'geojson',
        mimeType: 'application/geo+json',
        requiresGeometry: true,
        hint: '.geojson',
    },
    csv: {
        label: 'CSV',
        extension: 'csv',
        mimeType: 'text/csv',
        requiresGeometry: false,
        hint: '.csv',
    },
    gpkg: {
        label: 'GeoPackage',
        extension: 'gpkg',
        mimeType: 'application/geopackage+sqlite3',
        requiresGeometry: true,
        hint: '.gpkg',
    },
    shp: {
        label: 'Shapefile',
        // Zipped sidecars: yields `<stem>.shp.zip`.
        extension: 'shp.zip',
        mimeType: 'application/zip',
        requiresGeometry: true,
        hint: '.shp.zip',
    },
    gdb: {
        label: 'File Geodatabase',
        // Zipped .gdb directory: yields `<stem>.gdb.zip`.
        extension: 'gdb.zip',
        mimeType: 'application/zip',
        requiresGeometry: true,
        hint: '.gdb.zip',
    },
    fgb: {
        label: 'FlatGeobuf',
        extension: 'fgb',
        mimeType: 'application/octet-stream',
        requiresGeometry: true,
        hint: '.fgb',
    },
};

/** Filter registry to formats that work given the parquet's capabilities. */
export const availableFormats = (hasGeometry: boolean): ExportFormat[] =>
    (Object.keys(EXPORT_FORMATS) as ExportFormat[])
        .filter(f => hasGeometry || !EXPORT_FORMATS[f].requiresGeometry);

/** Safe filename stem from layer title. */
export const safeFilename = (layerTitle: string): string =>
    layerTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
