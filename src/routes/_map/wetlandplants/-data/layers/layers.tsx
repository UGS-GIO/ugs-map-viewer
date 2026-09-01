import { ArcGISMapServerLayerProps, LayerProps, PMTilesLayerProps } from "@/lib/types/mapping-types";

// Wetland Survey Sites — STAC-driven: pmtilesUrl, sourceLayer, renders and parquet come from
// the warehouse item `wetlands_plants_site`.
//
// Not visible until a style ships: the STAC item has no `ugs:renders` yet, so this PMTiles
// layer never gets a style fragment and data-map.tsx silently drops it (no error). Wired up
// correctly. Symbology: yellow for exact locations, red for confidential/approximate.
//
// PRIVACY: sites with privacystatus === 'Confidential' are geocoded to their true, exact
// location upstream. The old app's About text promises an approximate location instead, which
// isn't implemented in the pipeline yet. Filtered client-side (see wetlandplants/-index.tsx
// `vectorLayerFilters`) to exclude Confidential features rather than render their real
// coordinates. Do not remove that filter without a warehouse fix.
//
// RELATED TABLE: the STAC item carries a `wetlands_plants_species` asset (role 'related') with
// real `ugs:foreign_keys` on `surveyeventid` — the per-site species list the old app's About
// text describes. `wetlands_wetdash_siteattributes` looked like a candidate related table but
// shares no key with plants_site (sitecode vs siteid, 654 vs 1563 rows, no `ugs:foreign_keys`)
// and is shipped as its own independent layer below instead.
const wetlandSurveySitesLayerName = 'wetlands_plants_site';
export const wetlandSurveySitesTitle = 'Wetland Survey Sites';
const wetlandSurveySitesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: wetlandSurveySitesLayerName,
    pmtilesUrl: '',
    sourceLayer: wetlandSurveySitesLayerName,
    title: wetlandSurveySitesTitle,
    visible: true,
    sourceAgency: 'Utah Geological Survey',
    opacity: 1,
    sublayers: [
        {
            name: wetlandSurveySitesLayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Site Code': { field: 'sitecode', type: 'string' },
                'Ecoregional Group': { field: 'ecoregionalgroup', type: 'string' },
                'Wetland Type': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const primary = props?.['wetlandtype'];
                        const secondary = props?.['wetlandtype2'];
                        if (secondary && secondary !== 'N/A') return `${primary} / ${secondary}`;
                        return `${primary ?? ''}`;
                    },
                },
                'HGM Class': { field: 'hgm_class', type: 'string' },
                'Watershed': { field: 'watershed', type: 'string' },
                'Vegetation Condition': { field: 'vegetationcondition', type: 'string' },
                'Owner': { field: 'owner', type: 'string' },
                'Project': { field: 'project', type: 'string' },
                'Survey Date': { field: 'surveydate', type: 'date' },
                'Cover-Weighted Mean C': { field: 'cwmeanc', type: 'number', decimalPlaces: 1 },
                'Relative Native Cover': { field: 'relnativecover', type: 'number', decimalPlaces: 1, unit: '%' },
            },
            relatedTables: [
                {
                    // STAC-backed: url + surveyeventid join filled from the
                    // wetlands_plants_species related asset's ugs:foreign_keys.
                    fieldLabel: 'Plant Species',
                    stacAsset: 'wetlands_plants_species',
                    displayAs: 'table',
                    displayFields: [
                        { field: 'scientificname', label: 'Scientific Name' },
                        { field: 'commonname', label: 'Common Name' },
                        { field: 'family', label: 'Family' },
                        {
                            field: 'cover',
                            label: 'Cover',
                            format: 'number',
                            transform: (v) => v ? `${v}%` : '—',
                        },
                        { field: 'nativity', label: 'Nativity' },
                        { field: 'growthform', label: 'Growth Form' },
                        { field: 'duration', label: 'Duration' },
                        { field: 'cvalue', label: 'C-Value' },
                        {
                            field: 'noxious',
                            label: 'Noxious',
                            transform: (v) => (v === 'true' ? 'Yes' : 'No'),
                        },
                    ],
                    sortBy: 'cover',
                    sortDirection: 'desc',
                },
            ],
        },
    ],
};

// Wetland Dashboard Site Attributes — STAC-driven from warehouse item
// `wetlands_wetdash_siteattributes`. Despite the name, this does NOT share a join key with
// Wetland Survey Sites — sitecode (e.g. "CB-038") vs siteid (e.g. "5971926_ip2_ref2015"), row
// counts differ (654 vs 1563), no `ugs:foreign_keys`, and it isn't listed as a related asset
// on plants_site (which points at `wetlands_plants_species` instead — see above). Shipped as
// its own independent layer rather than a related-table popup; revisit only if the warehouse
// ever publishes a real join between the two.
const wetlandDashboardSitesLayerName = 'wetlands_wetdash_siteattributes';
export const wetlandDashboardSitesTitle = 'Wetland Dashboard Sites';
const wetlandDashboardSitesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: wetlandDashboardSitesLayerName,
    pmtilesUrl: '',
    sourceLayer: wetlandDashboardSitesLayerName,
    title: wetlandDashboardSitesTitle,
    subtitle: 'Wetland dashboard site attributes',
    visible: false,
    sourceAgency: 'Utah Geological Survey',
    opacity: 1,
    sublayers: [
        {
            name: wetlandDashboardSitesLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
                'Site ID': { field: 'siteid', type: 'string' },
                'Ecoregion': { field: 'ecoregion', type: 'string' },
                'Watershed (HUC8)': { field: 'huc_name', type: 'string' },
                'System Class': { field: 'sysclass', type: 'string' },
                'Wetland Type': { field: 'wet_type', type: 'string' },
                'Project': { field: 'project', type: 'string' },
                'Date': { field: 'date', type: 'date' },
            },
        },
    ],
};

// Land Ownership (SITLA) — not yet in the warehouse; reuses the same layer already configured
// in geophysics (src/routes/_map/geophysics/-data/layers/layers.tsx).
const landOwnershipConfig: ArcGISMapServerLayerProps = {
    type: 'map-image',
    url: 'https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership_WM/MapServer',
    title: 'Land Ownership',
    opacity: 0.5,
    visible: false,
};

const layersConfig: LayerProps[] = [
    wetlandSurveySitesConfig,
    wetlandDashboardSitesConfig,
    landOwnershipConfig,
];

export default layersConfig;
