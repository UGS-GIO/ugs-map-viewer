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
    'geometry',
    'metadata_publication_id',
    'quad_name',
    'review_status',
    'table_type',
    'target_epsg',
]);

export const isInternalColumn = (col: string): boolean => {
    const name = col.toLowerCase();
    return INTERNAL_COLUMNS.has(name) || name.startsWith('_') || /^bbox_[xy](min|max)$/.test(name);
};
