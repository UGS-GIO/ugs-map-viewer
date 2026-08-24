import { ArcGISMapServerLayerProps, LayerProps, PMTilesLayerProps } from "@/lib/types/mapping-types";

// Wetland Survey Sites — STAC-driven: pmtilesUrl, sourceLayer, renders and parquet come from
// the warehouse item `wetlands_plants_site`. ALL-5623.
//
// NOT VISIBLE YET (ALL-5625): wetlands_plants_site has no `ugs:renders` in STAC yet, and a
// PMTiles layer with zero renders + no styleUrl never gets a style fragment — data-map.tsx
// only renders layers with one loaded (see the pmtilesFragments.get(layer.title) gate), so
// this layer is silently dropped from the map today. No error, it just doesn't draw. This is
// wired up correctly and will appear once a render ships (ugs-styles → STAC ugs:renders),
// not a bug here. Per ALL-3726: yellow for exact locations, red for confidential/approximate.
//
// PRIVACY: sites with privacystatus === 'Confidential' are geocoded to their true, exact
// location in the warehouse today (dataELT passes `geom` through untouched — see the
// wetlands_plants_site lineage). The old app's About text promises these show at "a randomly
// assigned" nearby location instead, which isn't implemented anywhere upstream. Until a
// dataELT fix adds a real offset before PMTiles are built, this layer is filtered client-side
// (see wetlandplants/-index.tsx `vectorLayerFilters`) to exclude Confidential features rather
// than render their real coordinates. Do not remove that filter without a warehouse fix.
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
            popupEnabled: false,
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
        },
    ],
};

// Wetland Dashboard Site Attributes — STAC-driven from warehouse item
// `wetlands_wetdash_siteattributes`. NOTE: despite the name suggesting it's a child/related
// table of Wetland Survey Sites, the two datasets do NOT share a join key today — sitecode
// (e.g. "CB-038") on plants_site has no overlap with siteid (e.g. "5971926_ip2_ref2015") on
// this table, row counts differ (654 vs 1563), and neither STAC item carries
// `ugs:foreign_keys`. Shipping it as its own independent layer instead of a related-table
// popup until the relationship (if any) is confirmed with Nate and the warehouse publishes
// the join metadata.
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

// Land Ownership (SITLA) — ALL-5630. Not yet in the warehouse; copied source/naming from the
// same layer already used in geophysics (src/routes/_map/geophysics/-data/layers/layers.tsx)
// per the ticket's own instruction to reuse it rather than re-source it.
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
