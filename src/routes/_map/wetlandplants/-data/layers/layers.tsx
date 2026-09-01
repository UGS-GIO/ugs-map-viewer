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
// `wetlands_wetdash_siteattributes`. Despite the name, this does NOT share a join key with
// Wetland Survey Sites — sitecode (e.g. "CB-038") vs siteid (e.g. "5971926_ip2_ref2015"), row
// counts differ (654 vs 1563), no `ugs:foreign_keys` on either STAC item. Shipped as its own
// independent layer rather than a related-table popup; revisit only if the warehouse
// publishes a real join between the two.
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

// EcoRegional Groups — STAC-driven from warehouse item `wetlands_plants_ecoregion`. Level III
// (+ EPA region / state) ecoregion polygons used to classify Wetland Survey Sites into the
// "Central Basin and Range" / "Wasatch and Uinta Mountains" / etc. wetland classes the old
// app's About text describes.
//
// Same gotcha as Wetland Survey Sites: this STAC item has no `ugs:renders` yet, so it's wired
// up correctly but stays invisible until a style ships.
const ecoregionLayerName = 'wetlands_plants_ecoregion';
export const ecoregionTitle = 'EcoRegional Groups';
const ecoregionConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: ecoregionLayerName,
    pmtilesUrl: '',
    sourceLayer: ecoregionLayerName,
    title: ecoregionTitle,
    visible: false,
    sourceAgency: 'Utah Geological Survey',
    opacity: 0.5,
    sublayers: [
        {
            name: ecoregionLayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Ecoregional Group': { field: 'ecoregionalgroup', type: 'string' },
                'Level III Ecoregion': { field: 'us_l3name', type: 'string' },
                'Level III Code': { field: 'us_l3code', type: 'string' },
                'Level II Ecoregion': { field: 'na_l2name', type: 'string' },
                'Level I Ecoregion': { field: 'na_l1name', type: 'string' },
                'EPA Region': { field: 'epa_region', type: 'number' },
                'State': { field: 'state_name', type: 'string' },
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
    ecoregionConfig,
    landOwnershipConfig,
];

export default layersConfig;
