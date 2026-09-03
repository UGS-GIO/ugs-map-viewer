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
    // Source-format plumbing: Esri/OGR row ids and their geometry measures. The measures
    // are recorded in the source projection, so they don't match the exported geometry.
    'fid',
    'objectid',
    'ogc_fid',
    'pk',
    'shape_area',
    'shape_length',
    // Parquet exports drop their geometry column via `geometryColumn`; this is for the
    // table path, where geometry is emitted separately from the property list.
    'geometry',
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
