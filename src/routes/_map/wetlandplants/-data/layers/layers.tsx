import { ArcGISMapServerLayerProps, LayerProps, PMTilesLayerProps, WFSLayerProps } from "@/lib/types/mapping-types";

// Wetland Survey Sites — STAC-driven: pmtilesUrl, sourceLayer, renders and parquet come from
// the warehouse item `wetlands_plants_site`.
//
// Not visible until a style ships: the STAC item has no `ugs:renders` yet, so this PMTiles
// layer never gets a style fragment and data-map.tsx silently drops it (no error). Wired up
// correctly. Symbology: yellow for exact locations, red for confidential/approximate.
//
// PRIVACY: Confidential sites are geocoded to their true, exact location upstream; the old
// app's About text promises an approximate location instead, which the pipeline doesn't
// implement yet — verify against the live API rather than trusting a ticket's status. Filtered
// client-side (see wetlandplants/-index.tsx `vectorLayerFilters`) to exclude Confidential
// features rather than render their real coordinates. Do not remove without confirming the
// pipeline now offsets confidential geometries. Confidential sites are shown separately via
// `confidentialSitesConfig` below, jittered to an approximate location.
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

// Wetland Survey Sites — Confidential (Approximate). `wetlands_plants_site` is pre-baked
// PMTiles, so per-feature geometry can't be moved with a style/paint expression — hence a
// separate client-side layer. Fetches Confidential-only records from the warehouse's OGC API
// Features service (`rawGeoJsonUrl`, not classic WFS) and applies a deterministic per-site
// jitter (seeded on `sitecode`) so a site lands in the same spot on every load. Circle paint
// matches the published wetlands_plants_site style's Confidential case. Popup fields mirror
// the main layer's, plus a "Location" note. Known gap: "zoom to extent" won't resolve for this
// layer (see WFSLayerProps.rawGeoJsonUrl doc comment). Remove once wetlands_plants_site's own
// PMTiles geometry is pre-offset upstream.
const confidentialSitesUrl = 'https://ugs-warehouse-features-xedvkyurga-uc.a.run.app/collections/wetlands_plants_site/items.json?filter=privacystatus%3D%27Confidential%27&limit=1000';
export const confidentialSitesTitle = 'Wetland Survey Sites — Confidential (Approximate)';
const confidentialSitesConfig: WFSLayerProps = {
    type: 'wfs',
    wfsUrl: confidentialSitesUrl,
    rawGeoJsonUrl: confidentialSitesUrl,
    typeName: 'wetlands_plants_site_confidential',
    title: confidentialSitesTitle,
    subtitle: 'Approximate location — exact site withheld for privacy',
    visible: true,
    sourceAgency: 'Utah Geological Survey',
    opacity: 1,
    jitter: { seedField: 'sitecode', maxOffsetMeters: 1600 },
    style: {
        circleRadius: 4,
        circleColor: '#D7191C',
        circleStrokeColor: '#8B1213',
        circleStrokeWidth: 1,
    },
    sublayers: [
        {
            name: 'wetlands_plants_site_confidential',
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
                'Location': {
                    field: 'custom',
                    type: 'custom',
                    transform: () => 'Approximate — exact location withheld for privacy',
                },
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
    confidentialSitesConfig,
    wetlandDashboardSitesConfig,
    landOwnershipConfig,
];

export default layersConfig;
