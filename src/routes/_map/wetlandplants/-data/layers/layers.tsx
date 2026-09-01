import { ArcGISMapServerLayerProps, LayerProps, PMTilesLayerProps } from "@/lib/types/mapping-types";

// Wetland Survey Sites — from warehouse item `wetlands_plants_site`.
//
// Not visible until a style ships: no `ugs:renders` yet, so data-map.tsx silently drops this
// PMTiles layer. Symbology: yellow for exact locations, red for confidential/approximate.
//
// PRIVACY: Confidential sites are geocoded to their true location upstream; the pipeline
// doesn't offset them yet. Filtered client-side (see wetlandplants/-index.tsx
// `vectorLayerFilters`) rather than rendering real coordinates — don't remove without a
// warehouse fix.
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

// Wetland Dashboard Site Attributes — from warehouse item `wetlands_wetdash_siteattributes`.
// Despite the name, shares no join key with Wetland Survey Sites (sitecode vs siteid, 654 vs
// 1563 rows, no `ugs:foreign_keys`) — shipped as its own layer; revisit if the warehouse ever
// adds a join.
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

// EcoRegional Groups — from warehouse item `wetlands_plants_ecoregion`. Level III (+ EPA
// region / state) ecoregion polygons classifying Wetland Survey Sites into wetland classes
// ("Central Basin and Range", "Wasatch and Uinta Mountains", etc.). Same gotcha as Wetland
// Survey Sites: no `ugs:renders` yet, so invisible until a style ships.
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
