/**
 * Columns dropped from every download — table, layer list, and Data Sources — so the
 * three paths agree on which fields a dataset actually has.
 *
 * These are warehouse bookkeeping: pipeline provenance, envelope helpers, and internal
 * keys that mean nothing outside the warehouse.
 */
const INTERNAL_COLUMNS = new Set([
    'bbox',
    'feature_id',
    // Geometry column aliases (see use-parquet-schema GEOM_CANDIDATES). The parquet
    // exports already drop theirs via `geometryColumn`; this catches the table path,
    // where geometry is emitted separately and must not also appear as a property.
    'geom',
    'geometry',
    'wkb_geometry',
    'metadata_publication_id',
    'quad_name',
    'review_status',
    'scale',
    'table_type',
    'target_epsg',
]);

export const isInternalColumn = (col: string): boolean => {
    const name = col.toLowerCase();
    return INTERNAL_COLUMNS.has(name) || name.startsWith('_') || /^bbox_[xy](min|max)$/.test(name);
};
