import { GROUNDWATER_POSTGREST_URL, GROUNDWATER_WORKSPACE, PROD_GEOSERVER_URL } from "@/lib/constants";
import { LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";

// ============================================================================
// Groundwater Monitoring Portal Layers
//
// MIGRATION PATH TO UGS DATA WAREHOUSE:
// When Nate Payne adds `ugs_ngwmn_monitoring_locations` and `ugs_gw_sites`
// to the warehouse STAC catalog:
// 1. Change `type: 'wms'` -> `type: 'pmtiles'`
// 2. Set `stacItemId: 'ugs_ngwmn_monitoring_locations'` / `stacItemId: 'ugs_gw_sites'`
// 3. In `relatedTables`, replace `url` with `stacAsset: 'ugs_ngwmn_lithology'`,
//    `stacAsset: 'ugs_gw_notes'`, `stacAsset: 'ugs_gw_manualdata'`, etc.
// ============================================================================

// --- Well & Spring Locations (Point Monitoring Locations) ---
export const monitoringLocationsLayerName = 'ugs_ngwmn_monitoring_locations';
export const monitoringLocationsWMSTitle = 'Well & Spring Locations';

export const monitoringLocationsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: monitoringLocationsWMSTitle,
    opacity: 1,
    visible: true,
    crs: 'EPSG:3857',
    sourceAgency: 'Utah Geological Survey',
    sourceUrl: 'https://gwportal.geology.utah.gov/',
    customLayerParameters: { cql_filter: "display = '1'" },
    sublayers: [
        {
            name: `${GROUNDWATER_WORKSPACE}:${monitoringLocationsLayerName}`,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Location Name': { field: 'locationname', type: 'string' },
                'Location ID': { field: 'locationid', type: 'string' },
                'Location Type': { field: 'locationtype', type: 'string' },
                'Well Type': { field: 'welltype', type: 'string' },
                'Aquifer Name': { field: 'aquifername', type: 'string' },
                'National Aquifer': { field: 'nationalaquifer', type: 'string' },
                'Well Depth': { field: 'welldepth', type: 'number', unit: ' ft' },
                'Altitude / Elevation': { field: 'verticalmeasure', type: 'number', unit: ' ft' },
                'Network Name': { field: 'wlnetworkname', type: 'string' },
                'County': { field: 'county', type: 'string' },
                'State': { field: 'state', type: 'string' },
                'Description': { field: 'locationdesc', type: 'string' },
                'WIN': { field: 'win', type: 'number' },
                'USGS ID': { field: 'usgs_id', type: 'string' },
                'Water Right': { field: 'wrnum', type: 'string' },
                'Geophysical Log': { field: 'linkgeophysicallog', type: 'string' },
                'Lithologic Log': { field: 'linklithologiclog', type: 'string' },
                'Development Log': { field: 'linkdevelopmentlog', type: 'string' },
            },
            relatedTables: [
                {
                    // Lithology intervals per location
                    fieldLabel: 'Lithology',
                    url: `${GROUNDWATER_POSTGREST_URL}/ugs_ngwmn_lithology`,
                    targetField: 'locationid',
                    matchingField: 'siteno',
                    headers: { 'Accept': 'application/json' },
                    displayAs: 'table',
                    displayFields: [
                        { field: 'lithologydepthfrom', label: 'From (ft)', format: 'number' },
                        { field: 'lithologydepthto', label: 'To (ft)', format: 'number' },
                        { field: 'lithologydescription', label: 'Description' },
                        { field: 'observationmethod', label: 'Observation Method' },
                    ],
                    sortBy: 'lithologydepthfrom',
                    sortDirection: 'asc',
                },
                {
                    // Field notes per location
                    fieldLabel: 'Field Notes',
                    url: `${GROUNDWATER_POSTGREST_URL}/ugs_gw_notes`,
                    targetField: 'altlocationid',
                    matchingField: 'typeid',
                    headers: { 'Accept': 'application/json' },
                    displayAs: 'outline',
                    displayFields: [
                        { field: 'datetime', label: 'Date', transform: (v) => v ? new Date(String(v)).toLocaleDateString() : '—' },
                        { field: 'note', label: 'Note' },
                    ],
                    sortBy: 'datetime',
                    sortDirection: 'desc',
                },
                {
                    // Manual periodic water level & conductivity measurements
                    fieldLabel: 'Water Level Measurements',
                    url: `${GROUNDWATER_POSTGREST_URL}/ugs_gw_manualdata`,
                    targetField: 'altlocationid',
                    matchingField: 'locationid',
                    headers: { 'Accept': 'application/json' },
                    displayAs: 'table',
                    displayFields: [
                        { field: 'readingdate', label: 'Date', transform: (v) => v ? new Date(String(v)).toLocaleDateString() : '—' },
                        { field: 'waterelevation', label: 'Water Elev (ft)', format: 'number' },
                        { field: 'dtwbelowcasing', label: 'Depth to Water (ft)', format: 'number' },
                        { field: 'conductivity', label: 'Conductivity (µS/cm)', format: 'number' },
                        { field: 'datastatus', label: 'Status' },
                        { field: 'measureby', label: 'Measured By' },
                    ],
                    sortBy: 'readingdate',
                    sortDirection: 'desc',
                },
            ],
        },
    ],
};

// --- Site Areas (Groundwater Project Study Areas / Basins) ---
export const siteAreasLayerName = 'ugs_gw_sites';
export const siteAreasTitle = 'Site Areas';

export const siteAreasWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: siteAreasTitle,
    opacity: 0.7,
    visible: true,
    crs: 'EPSG:3857',
    sourceAgency: 'Utah Geological Survey',
    sourceUrl: 'https://gwportal.geology.utah.gov/',
    sublayers: [
        {
            name: `${GROUNDWATER_WORKSPACE}:${siteAreasLayerName}`,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Site Name': { field: 'name', type: 'string' },
                'Total Wells': { field: 'totalwellnumber', type: 'number' },
                'Description': { field: 'sitedescription', type: 'string' },
                'Point of Diversion (POD)': { field: 'pod', type: 'string' },
                'Notes': { field: 'notes', type: 'string' },
                'Additional Information': { field: 'linkadditionalinfo', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: 'Site Notes',
                    url: `${GROUNDWATER_POSTGREST_URL}/ugs_gw_notes`,
                    targetField: 'siteid',
                    matchingField: 'typeid',
                    headers: { 'Accept': 'application/json' },
                    displayAs: 'outline',
                    displayFields: [
                        { field: 'datetime', label: 'Date', transform: (v) => v ? new Date(String(v)).toLocaleDateString() : '—' },
                        { field: 'note', label: 'Note' },
                    ],
                    sortBy: 'datetime',
                    sortDirection: 'desc',
                },
            ],
        },
    ],
};

const layersConfig: LayerProps[] = [
    monitoringLocationsWMSConfig,
    siteAreasWMSConfig,
];

export default layersConfig;
