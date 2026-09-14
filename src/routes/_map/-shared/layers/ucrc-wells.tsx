import { BoxPhotosCell } from "@/components/maps/popups/box-photos-button";
import { ENERGY_MINERALS_WORKSPACE } from "@/lib/constants";
import { PMTilesLayerProps } from "@/lib/types/mapping-types";

// UCRC Collection Layer — a warehouse STAC/PMTiles layer (STAC item `enmin_ucrc_wells`)
// shared by the subsurface and carbonstorage routes. Rendered client-side for instant
// filtering and richer symbology. Routes reuse this config; carbonstorage overrides only
// its display title (see ALL-4356).
export const ucrcWellsLayerName = 'enmin_ucrc_wells_current';
// PMTiles tile source-layer = STAC item id (not the `_current` DB view name).
export const ucrcWellsTileLayer = 'enmin_ucrc_wells';
export const ucrcWellsQualifiedName = `${ENERGY_MINERALS_WORKSPACE}:${ucrcWellsLayerName}`;
export const ucrcWellsWMSTitle = 'Utah Core Research Center Inventory';

// UCRC symbology (purpose + box-type colours, box-type grouping/shades) is derived entirely from
// the STAC render legends (by-purpose / by-boxtype) — see ugs-styles. Nothing hardcoded here.

// STAC-driven: pmtilesUrl, sourceLayer, renders (by-purpose / by-boxtype incl.
// the baked pie-wedge sprite + legends) and parquet are filled from the
// warehouse STAC item `enmin_ucrc_wells` at load. Symbology is the hosted
// renders, selected via vector_symbology; the app config carries only UX.
export const ucrcWellsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: 'enmin_ucrc_wells',
    pmtilesUrl: '',
    sourceLayer: ucrcWellsTileLayer,
    title: ucrcWellsWMSTitle,
    visible: true,
    opacity: 0.85,
    defaultRenderId: 'by-boxtype',
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: ucrcWellsTileLayer,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'API Number': { field: 'api_number', type: 'string' },
                'UWI': { field: 'uwi', type: 'string' },
                'Well Name': { field: 'well_name', type: 'string' },
                'County': { field: 'county', type: 'string' },
                'Operator': { field: 'current_operator', type: 'string' },
                'Field': { field: 'field_name', type: 'string' },
                'Purpose': { field: 'purpose', type: 'string' },
                'Producing Formation': { field: 'producing_formation', type: 'string' },
                'TD (ft)': {
                    field: 'td_ft',
                    type: 'custom',
                    transform: (properties) => {
                        const val = properties?.['td_ft'];
                        if (val === null || val === undefined || val === 0 || val === '0') return null;
                        return val;
                    }
                },
                'Elevation (GL ft)': {
                    field: 'elevation_gl',
                    type: 'custom',
                    transform: (properties) => {
                        const val = properties?.['elevation_gl'];
                        if (val === null || val === undefined || val === 0 || val === '0') return null;
                        return val;
                    }
                },
                'Kelly bushing Elevation (GL ft)': {
                    field: 'elevation_kb',
                    type: 'custom',
                    transform: (properties) => {
                        const val = properties?.['elevation_kb'];
                        if (val === null || val === undefined || val === 0 || val === '0') return null;
                        return val;
                    }
                },
                'Latitude': { field: 'latitude', type: 'number' },
                'Longitude': { field: 'longitude', type: 'number' },
                'Easting (NAD83)': {
                    field: 'easting',
                    type: 'custom',
                    transform: (properties) => {
                        const val = properties?.['easting'];
                        if (val === null || val === undefined || val === 0 || val === '0') return null;
                        return val;
                    }
                },
                'Northing (NAD83)': {
                    field: 'northing',
                    type: 'custom',
                    transform: (properties) => {
                        const val = properties?.['northing'];
                        if (val === null || val === undefined || val === 0 || val === '0') return null;
                        return val;
                    }
                },
                'Township': { field: 'township', type: 'string' },
                'Range': { field: 'range', type: 'string' },
                'Section': { field: 'section', type: 'string' },
                'Notes': { field: 'notes_public', type: 'string' },
            },
            relatedTables: [
                {
                    // Contiguous Core/Cuttings depth intervals, merged in the warehouse
                    // (mart_enmin_ucrc_sampleintervals) — 10 ft gap threshold is domain policy
                    // and lives with the data, not here.
                    fieldLabel: 'Sample Types',
                    stacAsset: 'enmin_ucrc_sampleintervals',
                    displayAs: 'table',
                    displayFields: [
                        { field: 'sample_type', label: 'Type' },
                        { field: 'top_ft', label: 'Top (ft)', format: 'number' },
                        { field: 'bottom_ft', label: 'Bottom (ft)', format: 'number' },
                        { field: 'box_count', label: 'Boxes', format: 'number' },
                        { field: 'notes_public', label: 'Notes', transform: (v) => v || '—' },
                    ],
                    sortBy: 'top_ft',
                    sortDirection: 'asc',
                },
                {
                    // STAC-backed: url + uwi join filled from the enmin_ucrc_boxes related asset.
                    fieldLabel: 'Core Boxes',
                    stacAsset: 'enmin_ucrc_boxes',
                    displayAs: 'table',
                    displayFields: [
                        { field: 'box_number', label: 'Box #' },
                        { field: 'box_type', label: 'Type' },
                        { field: 'box_top_ft', label: 'Top (ft)', format: 'number' },
                        { field: 'box_bottom_ft', label: 'Bottom (ft)', format: 'number' },
                        { field: 'cored_formation', label: 'Formation' },
                        {
                            field: 'pk',
                            label: 'Photos',
                            transform: (pk, row, allRows) => (
                                <BoxPhotosCell
                                    boxId={pk}
                                    photoCount={row?.photo_count != null ? Number(row.photo_count) : undefined}
                                    // Only bulk-fetch boxes that actually have photos (when photo_count is
                                    // published); fall back to all boxes when the column isn't there yet.
                                    allBoxIds={(allRows ?? [])
                                        .filter(r => r.photo_count == null || Number(r.photo_count) > 0)
                                        .map(r => String(r.pk))}
                                    boxLabel={`${row?.uwi ?? 'core'}_box${row?.box_number ?? pk}_${row?.box_top_ft ?? '?'}-${row?.box_bottom_ft ?? '?'}ft`}
                                />
                            ),
                        },
                        { field: 'notes_public', label: 'Notes', transform: (v) => v || '—' },
                    ],
                    sortBy: 'box_number',
                    sortDirection: 'asc',
                },
                {
                    fieldLabel: 'Documents',
                    // STAC-backed: url (= the attachments geoparquet href), the uwi join, and
                    // fetchMode 'parquet' are filled from the `enmin_ucrc_attachments` related asset
                    // on the wells STAC item — same CDN read path as Sample Types / Core Boxes.
                    stacAsset: 'enmin_ucrc_attachments',
                    displayAs: 'documents',
                    itemBaseUrl: 'https://ucrc-assets.geology.utah.gov',
                    sortBy: 'filename',
                    sortDirection: 'asc',
                    // The panel renders from the raw rows (filename + storage_path), grouped by type.
                    // Pin displayFields to just `filename`: it drives the "has data" gate and the
                    // related-table CSV export, and keeps the parquet's internal `notes` column
                    // (backfill provenance, not public metadata) out of the CSV — otherwise the STAC
                    // resolver defaults displayFields to every column.
                    displayFields: [
                        { field: 'filename', label: 'File' },
                    ],
                },
            ],
        },
    ],
};
