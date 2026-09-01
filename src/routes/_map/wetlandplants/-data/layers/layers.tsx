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

// Watershed (HUC8) Boundaries — STAC-driven from warehouse item `wetlands_plants_huc8`
// (columns are `name`/`huc8`, not `huc_name` like the old wetdash table). Supplementary
// boundary layer, off by default — same pattern as EcoRegional Groups. Like EcoRegional
// Groups, this STAC item has no `ugs:renders` yet, so it's wired up correctly but stays
// invisible until a style ships.
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
