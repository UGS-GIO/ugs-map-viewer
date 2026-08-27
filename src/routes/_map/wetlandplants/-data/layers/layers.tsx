import { ArcGISMapServerLayerProps, LayerProps, PMTilesLayerProps, WFSLayerProps } from "@/lib/types/mapping-types";

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
// assigned" nearby location instead; ALL-5709 proposed a dataELT fix for that and is marked
// Done in Jira, but re-verified while building ALL-5753 that the fix was never actually
// written (nothing in the dataELT repo, live OGC Features API still returns the raw
// coordinate) — don't trust that ticket's status. This layer is filtered client-side (see
// wetlandplants/-index.tsx `vectorLayerFilters`) to exclude Confidential features entirely
// rather than render their real coordinates. Do not remove that filter without confirming the
// warehouse pipeline now offsets confidential geometries. Confidential sites are instead shown
// via `confidentialSitesConfig` below, at a client-side jittered approximate location — see
// that config's comment for why it's a separate layer instead of a PMTiles style tweak.
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

// Wetland Survey Sites — Confidential (Approximate) — ALL-5753. `wetlands_plants_site` is
// pre-baked PMTiles; per-feature geometry can't be moved with a MapLibre style/paint
// expression, which is why this is a separate client-side layer rather than a tweak to the
// PMTiles style above. Fetches Confidential-only records straight from the warehouse's OGC
// API Features service (bypassing WFSLayerProps' classic-WFS GetFeature URL builder via
// `rawGeoJsonUrl` — this endpoint is OGC API Features, not GeoServer WFS) and applies a
// deterministic per-site jitter (`jitter`, seeded on `sitecode`) so the same site lands in the
// same spot on every load instead of wandering. Circle paint copied verbatim from the
// published wetlands_plants_site style's Confidential case
// (https://maps-assets.geology.utah.gov/styles/styles/wetlands_plants_site/default.json) so it
// reads as the same symbol, just at an approximate spot. Popup fields mirror the main layer's,
// plus a "Location" note — matches the old app's behavior of still surfacing Confidential
// sites in query results, just not their exact position. Known gap: the layer list's "zoom to
// extent" won't resolve for this layer (see WFSLayerProps.rawGeoJsonUrl doc comment);
// acceptable for a one-off privacy overlay. Remove this whole layer once ALL-5709 actually
// ships and wetlands_plants_site's own PMTiles geometry is pre-offset.
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
    confidentialSitesConfig,
    wetlandDashboardSitesConfig,
    landOwnershipConfig,
];

export default layersConfig;
