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

// Watershed (HUC8) Boundaries — from warehouse item `wetlands_plants_huc8` (columns are
// `name`/`huc8`, not `huc_name` like the old wetdash table). Off by default, same pattern as
// EcoRegional Groups — including no `ugs:renders` yet, so invisible until a style ships.
const huc8LayerName = 'wetlands_plants_huc8';
export const huc8Title = 'Watershed (HUC8) Boundaries';
const huc8Config: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: huc8LayerName,
    pmtilesUrl: '',
    sourceLayer: huc8LayerName,
    title: huc8Title,
    visible: false,
    sourceAgency: 'Utah Geological Survey',
    opacity: 0.5,
    sublayers: [
        {
            name: huc8LayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Watershed Name': { field: 'name', type: 'string' },
                'HUC8 Code': { field: 'huc8', type: 'string' },
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
    huc8Config,
    landOwnershipConfig,
];

export default layersConfig;
