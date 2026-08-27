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

// Watershed (HUC8) Boundaries — ALL-5628/ALL-5752. STAC-driven from warehouse item
// `wetlands_plants_huc8` (columns confirmed against the live STAC item's table:columns —
// it's `name`/`huc8`, not `huc_name` like the old wetdash table). Supplementary boundary
// layer, off by default — same pattern as EcoRegional Groups. Popup fields match the old
// app's hucLayer popup (map.js: Name + HUC8 only). NOTE: like EcoRegional Groups,
// `wetlands_plants_huc8` has no `ugs:renders` in STAC yet, so this is wired up correctly but
// stays invisible on the map until a style ships (ALL-5629).
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
    huc8Config,
    landOwnershipConfig,
];

export default layersConfig;
