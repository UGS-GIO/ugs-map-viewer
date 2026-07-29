import { ENERGY_MINERALS_WORKSPACE, HAZARDS_WORKSPACE, MAPPING_WORKSPACE, parquetUrl, PROD_GEOSERVER_URL } from "@/lib/constants";
import { ArcGISMapServerLayerProps, COGLayerProps, LayerProps, PMTilesLayerProps, WMSLayerProps } from "@/lib/types/mapping-types";
import { GeoJsonProperties } from "geojson";
import { toTitleCase, toSentenceCase } from "@/lib/utils";

// Roads WMS Layer
const roadsLayerName = 'ccus_majorroads';
const roadsWMSTitle = 'Major Roads';
const roadsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: roadsWMSTitle,
    visible: false,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${roadsLayerName}`,
            popupEnabled: false,
            queryable: false,
            popupFields: {
                'Name': { field: 'fullname', type: 'string', transform: (value) => toTitleCase(value || '') },
            },
        },
    ],
};

// Railroads WMS Layer
const railroadsLayerName = 'ccus_railroads';
const railroadsWMSTitle = 'Railroads';
const railroadsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: railroadsWMSTitle,
    visible: false,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${railroadsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'railroad', type: 'string', transform: (value) => toTitleCase(value || '') },
            },
        },
    ],
};

// Transmission Lines WMS Layer
const transmissionLinesLayerName = 'ccus_transmissionlines';
const transmissionLinesWMSTitle = 'Transmission Lines';
const transmissionLinesWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: transmissionLinesWMSTitle,
    visible: false,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${transmissionLinesLayerName}`,
            popupEnabled: false,
            queryable: false,
            popupFields: {
                'Voltage': { field: 'layer', type: 'string' },
            },
        },
    ],
}

// Seamless Geological Units WMS Layer
const seamlessGeolunitsLayerName = 'mapping_geolunits_500k'
const seamlessGeolunitsWMSTitle = 'Geologic Units (500k)';
const seamlessGeolunitsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/mapping/wms`,
    title: seamlessGeolunitsWMSTitle,
    opacity: 0.5,
    visible: false,
    sublayers: [
        {
            name: `${MAPPING_WORKSPACE}:${seamlessGeolunitsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Unit': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const unitName = props?.['unit_name'];
                        const unitSymbol = props?.['unit_symbol'];
                        const value = `${unitName} (${unitSymbol})`;
                        return value;
                    }
                },
                'Unit Description': { field: 'unit_description', type: 'string' },
                'Source': { field: 'series_id', type: 'string' },
            },
            linkFields: {
                'series_id': {
                    baseUrl: '',
                    transform: (value: string) => {
                        const transformedValues = {
                            href: `https://doi.org/10.34191/${value}`,
                            label: `${value}`
                        };
                        return [transformedValues];
                    }
                }
            }
        },
    ],
};

// SITLA Land Ownership Layer (ArcGIS MapServer)
const SITLAConfig: ArcGISMapServerLayerProps = {
    type: 'map-image',
    url: 'https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership_WM/MapServer',
    title: 'Land Ownership',
    opacity: 0.5,
    visible: false,
};


const faultsLayerName = 'faults_m-179dm';
const faultsWMSTitle = 'Utah Faults';
const faultsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: faultsWMSTitle,
    visible: false,
    sublayers: [
        {
            name: `${MAPPING_WORKSPACE}:${faultsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Description': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const subtype = props?.['subtype'];
                        const type = props?.['type'];
                        const modifier = props?.['modifier'];
                        const value = `${subtype} ${type}, ${modifier}`
                        return toSentenceCase(value);
                    }
                },
                'Scale': {
                    field: 'scale',
                    type: 'string',
                    transform: (value) => {
                        if (value === 'small') return '1:500,000'
                        return ''
                    }
                },
                'Source': { field: 'series_id', type: 'string' },
            },
            linkFields: {
                'series_id': {
                    baseUrl: '',
                    transform: (value: string) => {
                        const transformedValues = {
                            href: `https://doi.org/10.34191/${value}`,
                            label: `${value}`
                        };
                        return [transformedValues];
                    }
                }
            }
        },
    ],
};


const qFaultsLayerName = 'hazards_qfaults_current';
const qFaultsWMSTitle = 'Hazardous Faults - Utah Quaternary Fault Database';
const qFaultsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: qFaultsWMSTitle,
    visible: false,
    downloadParquetUrl: parquetUrl("hazards_qfaults"),
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${qFaultsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Fault Zone Name': { field: 'faultzone', type: 'string' },
                'Summary': { field: 'summary', type: 'string' },
                'Fault Name': { field: 'faultname', type: 'string' },
                'Section Name': { field: 'sectionname', type: 'string' },
                'Strand Name': { field: 'strandname', type: 'string' },
                'Structure Number': { field: 'faultnum', type: 'string' },
                'Mapped Scale': { field: 'mappedscale', type: 'string' },
                'Dip Direction': { field: 'dipdirection', type: 'string' },
                'Slip Sense': { field: 'slipsense', type: 'string' },
                'Slip Rate': { field: 'sliprate', type: 'string' },
                'Structure Class': { field: 'faultclass', type: 'string' },
                'Structure Age': { field: 'faultage', type: 'string' },
                'UGS Source Report': {
                    field: 'notes',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        return props?.['notes'] || 'No UGS link available';
                    }
                },
                ' ': {
                    field: 'usgs_link',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        return props?.['usgs_link'] || 'No USGS link available';
                    }
                },
            },
            linkFields: {
                'notes': {
                    transform: (value: unknown) => {
                        const str = String(value ?? '');
                        if (!str || !str.startsWith('http')) {
                            return [{ label: 'Detailed report not currently available', href: '' }];
                        }
                        return [{ label: str, href: str }];
                    }
                },
                'usgs_link': {
                    transform: (value: unknown) => {
                        const str = String(value ?? '');
                        if (!str || !str.startsWith('http')) {
                            return [{ label: str || 'No USGS link available', href: '' }];
                        }
                        return [{ label: 'USGS Reference', href: str }];
                    }
                },
            },
        },
    ],
};

// Power Plants — STAC-driven: pmtilesUrl, sourceLayer, renders (colour by `primsource`, radius by
// `total_mw`) and parquet come from the warehouse item `enmin_powerplants`. Symbology in ugs-styles.
const powerplantsLayerName = 'enmin_powerplants';
export const powerplantsTitle = 'Power Plants';
const powerplantsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: powerplantsLayerName,
    pmtilesUrl: '',
    sourceLayer: powerplantsLayerName,
    title: powerplantsTitle,
    visible: true,
    opacity: 1,
    sublayers: [
        {
            name: powerplantsLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'plant_name', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Primary Source': { field: 'primsource', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Capacity (MW)': { field: 'total_mw', type: 'number' },
                'Operator': { field: 'utility_na', type: 'string' },
                'City': { field: 'city', type: 'string' },
                'County': { field: 'county', type: 'string' },
            },
        }
    ],
};

// geothermalWells WMS Layer
const geothermalWellsLayerName = 'mart_geothermal_wellsandsprings_current';
const geothermalWellsWMSTitle = 'Geothermal Wells & Springs (UGS)';
const geothermalWellsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: geothermalWellsWMSTitle,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${geothermalWellsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Type': {
                    field: 'type',
                    type: 'string',
                    transform: (value) => {
                        if (value === 'W') return 'Well'
                        if (value === 'S') return 'Spring'
                        return value
                    }
                },
                'Map Number': { field: 'mapno', type: 'string' },
                'Region': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const toTitleCase = (str: string) => {
                            return str
                                .toLowerCase()
                                .split(' ')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                        };

                        const regionl = props?.['region_loc'];
                        const countyl = props?.['county'];

                        const formattedStart = typeof regionl === 'string' ? toTitleCase(regionl) : regionl;
                        const formattedEnd = typeof countyl === 'string' ? toTitleCase(countyl) : countyl;

                        return `${formattedStart}, ${formattedEnd}`;
                    }
                },
                'Well/Spring Name': { field: 'source', type: 'string' },
                'UGS Name': { field: 'idname', type: 'string' },
                'Temperature': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const bht = props?.['temp'];
                        return `${bht} °C`;
                    }
                },
                'Class': { field: 'class', type: 'string' },
                'Depth of Well': { field: 'depth', type: 'number' },
                'Flow': { field: 'flow', type: 'number' },
                'Rate': { field: 'rate', type: 'string' },
                'Location': { field: 'lat', type: 'string' },
                'UTM (Easting/Northing)': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const utmStart = props?.['utme'];
                        const utmEnd = props?.['utmn'];
                        return `${utmStart} - ${utmEnd}`;
                    }
                },
                'Date': { field: 'date', type: 'date' },
                'Reference': { field: 'reference', type: 'string' },
                'Conductivity (microsiemens)': { field: 'cond', type: 'string' },
            },
            popupFieldsTable: [
                {
                    sectionLabel: 'Water Chemistry',
                    labelHeader: 'Chemical',
                    valueHeader: 'Measurement',
                    fields: [
                        { label: 'pH', config: { field: 'ph', type: 'string' } },
                        { label: 'Sodium', config: { field: 'na', type: 'string' }, unit: 'mg/l' },
                        { label: 'Potassium', config: { field: 'k', type: 'string' }, unit: 'mg/l' },
                        { label: 'Calcium', config: { field: 'ca', type: 'string' }, unit: 'mg/l' },
                        { label: 'Magnesium', config: { field: 'mg', type: 'string' }, unit: 'mg/l' },
                        { label: 'Aluminum', config: { field: 'al', type: 'string' }, unit: 'mg/l' },
                        { label: 'Iron', config: { field: 'fe', type: 'string' }, unit: 'mg/l' },
                        { label: 'Silica', config: { field: 'sio2', type: 'string' }, unit: 'mg/l' },
                        { label: 'Boron', config: { field: 'b', type: 'string' }, unit: 'mg/l' },
                        { label: 'Lithium', config: { field: 'li', type: 'string' }, unit: 'mg/l' },
                        { label: 'Bicarbonate', config: { field: 'hco3', type: 'string' }, unit: 'mg/l' },
                        { label: 'Sulfate', config: { field: 'so4', type: 'string' }, unit: 'mg/l' },
                        { label: 'Chlorine', config: { field: 'cl', type: 'string' }, unit: 'mg/l' },
                        { label: 'Fluorine', config: { field: 'f', type: 'string' }, unit: 'mg/l' },
                        { label: 'Arsenic', config: { field: 'as', type: 'string' }, unit: 'mg/l' },
                        { label: 'TDS Measured', config: { field: 'tdsm', type: 'string' }, unit: 'mg/l' },
                        { label: 'TDS Calculated', config: { field: 'tdsc', type: 'string' }, unit: 'mg/l' },
                        { label: 'Cat/Anion Charge Balance', config: { field: 'chgbal', type: 'string' } },
                    ],
                },
            ],
        },
    ],
};

// heatflow Layer
const heatflowLayeName = 'mart_geophysics_heatflowedwards_source_current';
const heatflowLayeTitle = 'Heat-Flow Data';
const heatflowLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: heatflowLayeTitle,
    visible: true,
    downloadParquetUrl: parquetUrl("mart_geophysics_heatflowedwards_source"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${heatflowLayeName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'UWI': { field: 'uwi', type: 'string' },
                'Drill Depth': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const depthStart = props?.['depth_start_m'];
                        const depthEnd = props?.['depth_end_m'];
                        return `${depthStart} - ${depthEnd} m`;
                    }
                },
                'Bottom Hole Temperature': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const bht = props?.['bht_c'];
                        return `${bht} °C`;
                    }
                },
                'Uncorrected Gradient (degrees/km)': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const bht = props?.['un_grad_c_km'];
                        return `${bht} °C/km`;
                    }
                },
                'Uncorrected Heatflow': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const bht = props?.['un_hf_mw_m2'];
                        return `${bht} mW/m²`;
                    }
                },
                'Citation': { field: 'citation', type: 'string' },
                'Location (NAD27)': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const depthStart = props?.['latnad27'];
                        const depthEnd = props?.['longnad27'];
                        return `${depthStart} , ${depthEnd}`;
                    }
                },
            },
        },
    ],
};

// geothermal uses
const geothermalUseLayeName = 'geothermal_utgeothermaluses_current';
const geothermalUseLayeTitle = 'Utah Geothermal Uses';
const geothermalUseLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: geothermalUseLayeTitle,
    visible: true,
    downloadParquetUrl: parquetUrl("geothermal_utgeothermaluses"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${geothermalUseLayeName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
                'Temperature (°C)': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const bht = props?.['temp_c'];
                        return `${bht} °C`;
                    }
                },
                'Use': { field: 'use', type: 'string' },
                'Location': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const depthStart = props?.['locality'];
                        const depthEnd = props?.['county'];
                        return `${depthStart}, ${depthEnd}`;
                    }
                },
            },
        },
    ],
};

// deep sedimentary basins
const deepSedimentaryBasinsLayerName = 'geothermal_deepsedbasin_current';
const deepSedimentaryBasinsLayerTitle = 'Geothermal Deep Sedimentary Basins';
const deepSedimentaryBasinsLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: deepSedimentaryBasinsLayerTitle,
    visible: true,
    downloadParquetUrl: parquetUrl("geothermal_deepsedbasin"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${deepSedimentaryBasinsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Basin Name': { field: 'basin_name', type: 'string' },
            },
        },
    ],
};

// potential resource areas
const potentialResourcesLayerName = 'geothermal_potentialresourcearea_current';
const potentialResourcesLayerTitle = 'Potential Geothermal Resource Areas';
const potentialResourcesLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: potentialResourcesLayerTitle,
    visible: true,
    downloadParquetUrl: parquetUrl("geothermal_potentialresourcearea"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${potentialResourcesLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'ID': { field: 'id', type: 'string' },
            },
        },
    ],
};

// Known Geothermal Resource Areas (KGRA)
const geothermalKgraLayerName = 'geothermal_kgra_current';
const geothermalKgraLayerTitle = 'Known Geothermal Resource Areas';
const geothermalKgraLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: geothermalKgraLayerTitle,
    visible: true,
    downloadParquetUrl: parquetUrl("geothermal_kgra"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${geothermalKgraLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'kgra', type: 'string' },
            },
        },
    ],
};

// gravity stations
const gravityStationsLayeName = 'enmin_geophysics_ugsgravity_current';
export const gravityStationsLayeTitle = 'Modern Gravity Stations';
const gravityStationsLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: gravityStationsLayeTitle,
    visible: true,
    downloadParquetUrl: parquetUrl("enmin_geophysics_ugsgravity"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${gravityStationsLayeName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Station ID': { field: 'unique_id', type: 'string' },
                'Location (WGS84)': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const depthStart = props?.['lat_wgs84'];
                        const depthEnd = props?.['long_wgs84'];
                        return `${depthStart}, ${depthEnd}`;
                    }
                },
                'Date': { field: 'date', type: 'date' },
                'Observed Measurement (mGal)': {
                    field: 'observed_grav_mgal',
                    type: 'number',
                    decimalPlaces: 3,
                    unit: 'mGal',
                },
            },
        },
    ],
};

// Legacy Gravity Stations
const pacesLegacyLayerName = 'enmin_geophysics_pacesgravity_current';
const pacesLegacyLayerTitle = 'Legacy Gravity Stations';
const pacesLegacyLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: pacesLegacyLayerTitle,
    visible: false,
    downloadParquetUrl: parquetUrl("enmin_geophysics_pacesgravity"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${pacesLegacyLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Station ID': { field: 'unique_id', type: 'string' },
                'Location (WGS84)': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const depthStart = props?.['lat_wgs84'];
                        const depthEnd = props?.['long_wgs84'];
                        return `${depthStart}, ${depthEnd}`;
                    }
                },
                'Observed Measurement (mGal)': { field: 'observed_grav_mgal', type: 'number', decimalPlaces: 3, unit: 'mGal' },
            },
        },
    ],
};

// TEM data
const geothermalTEMLayerName = 'enmin_geophysics_tem_current';
export const geothermalTEMLayerTitle = 'Transient Electromagnetic Data (TEM)';
const geothermalTEMLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: geothermalTEMLayerTitle,
    visible: true,
    customLayerParameters: { cql_filter: "dataquality IN ('1','2')" },
    downloadParquetUrl: parquetUrl("enmin_geophysics_tem"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${geothermalTEMLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Location': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const lat = props?.['lat_nad83'];
                        const lon = props?.['lon_nad83'];
                        return lat != null && lon != null ? `${lat}, ${lon}` : '';
                    }
                },
                'Site Name': { field: 'station', type: 'string' },
                'Date': { field: 'date', type: 'date' },
                'Archive Link': { field: 'archivelink', type: 'string' },
            },
        },
    ],
};

// MT Stations
const mtStationsLayerName = 'enmin_geophysics_mtstations_current';
const mtStationsLayerTitle = 'Magnetotelluric Data (MT)';
const mtStationsLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: mtStationsLayerTitle,
    visible: true,
    downloadParquetUrl: parquetUrl("enmin_geophysics_mtstations"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${mtStationsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Station': { field: 'station', type: 'string' },
                'Project': { field: 'project', type: 'string' },
                'Location (WGS84)': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const lat = props?.['lat_wgs84'];
                        const lon = props?.['long_wgs84'];
                        return lat != null && lon != null ? `${lat}, ${lon}` : '';
                    }
                },
            },
            linkFields: {
                'link': {
                    baseUrl: '',
                    transform: (value: string) => {
                        if (!value) return [{ href: '', label: '' }];
                        return [{
                            href: value,
                            label: 'Archive Link',
                        }];
                    }
                }
            }
        },
    ],
};

// Wells and Springs with Joins WMS Layer
const geothermalWellsJoinsName = 'enmin_geothermal_ingenious_wellfeatures_current';
const geothermalWellsJoinsTitle = 'Geothermal Wells (INGENIOUS)';
const geothermalWellsJoinsConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: geothermalWellsJoinsTitle,
    visible: false,
    downloadParquetUrl: parquetUrl("enmin_geothermal_ingenious_wellfeatures"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${geothermalWellsJoinsName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Feature URI': { field: 'featureuri', type: 'string' },
                'Well Name': { field: 'wellname', type: 'string' },
                'API Number': { field: 'apino', type: 'string' },
                'Well Type': { field: 'welltype', type: 'string' },
                'Thermal Class': { field: 'thermalclass', type: 'string' },
                'Max Measured Temperature (°C)': { field: 'maxmeasuredtemp_c', type: 'number' },
                'Latitude': { field: 'latdegree', type: 'number' },
                'Longitude': { field: 'longdegree', type: 'number' },
                'Elevation Ground Level (m)': { field: 'elevationgl_m', type: 'number' },
                'Driller Total Depth (m)': { field: 'drillertotaldepth_m', type: 'number' },
                'True Vertical Depth (m)': { field: 'trueverticaldepth_m', type: 'number' },
                'In Formation': { field: 'informationsource', type: 'string' },
                'Has Temperature Data': {
                    field: 'hastemperaturedata', type: 'string', transform: (value: string | null) => {
                        if (value === '1') return 'YES'
                        return 'NO'
                    },
                },
                'Has Geochemistry Data': {
                    field: 'hasgeochemistrydata', type: 'string', transform: (value: string | null) => {
                        if (value === '1') return 'YES'
                        return 'NO'
                    },
                },
                'Sort ID': { field: 'sortid', type: 'string' },
                '': { field: 'geothermal_link', type: 'custom', transform: (() => 'Geothermal Data Repository') },
            },
            linkFields: {
                'geothermal_link': {
                    transform: (value: string | null) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://gdr.openei.org/submissions/1391'
                            }
                        ];
                    }
                }
            },
        },
    ],
};

// Springs with Joins WMS Layer
const geothermalSpringsJoinsName = 'enmin_geothermal_ingenious_springfeatures_current';
const geothermalSpringsJoinsTitle = 'Geothermal Springs (INGENIOUS)';
const geothermalSpringsJoinsConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: geothermalSpringsJoinsTitle,
    visible: false,
    downloadParquetUrl: parquetUrl("enmin_geothermal_ingenious_springfeatures"),
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${geothermalSpringsJoinsName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Feature URI': { field: 'featureuri', type: 'string' },
                'Spring Name': { field: 'springname', type: 'string' },
                'Thermal Class': { field: 'thermalclass', type: 'string' },
                'Max Measured Temperature (°C)': { field: 'maxmeasured_temp_c', type: 'number' },
                'Latitude': { field: 'latdegree', type: 'number' },
                'Longitude': { field: 'longdegree', type: 'number' },
                'Elevation Ground Level (m)': { field: 'elevationgl_m', type: 'number' },
                'In Formation': { field: 'informationsource', type: 'string' },
                'Has Temperature Data': {
                    field: 'hastemperaturedata', type: 'string', transform: (value: string | null) => {
                        if (value === '1') return 'YES'
                        return 'NO'
                    },
                },
                'Has Geochemistry Data': {
                    field: 'hasgeochemistrydata', type: 'string', transform: (value: string | null) => {
                        if (value === '1') return 'YES'
                        return 'NO'
                    },
                },
                'Sort ID': { field: 'sortid', type: 'string' },
                '': { field: 'geothermal_link', type: 'custom', transform: (() => 'Geothermal Data Repository') },
            },
            linkFields: {
                'geothermal_link': {
                    transform: (value: string | null) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://gdr.openei.org/submissions/1391'
                            }
                        ];
                    }
                }
            },
        },
    ],
};

// CGBA Gravity Anomalies — COG via CDN. Stretch derived dynamically from STAC raster:bands stats.
const cgbaBouguerCOGConfig: COGLayerProps = {
    type: 'cog',
    title: 'Complete Bouguer Gravity Anomaly',
    visible: false,
    opacity: 0.9,
    cogUrl: 'https://maps-assets.geology.utah.gov/geophysics/cbgaras-cog.tif',
    stacUrl: 'https://maps-assets.geology.utah.gov/geophysics/cbgaras.stac.json',
    stretchMode: 'minmax',
    colorStops: ['#440154', '#31688e', '#35b779', '#c8e020', '#fde725'],
    continuous: true,
    legendUnit: 'mGal',
    popupValueLabel: 'Gravity Anomaly',
};

const geophysicalDataConfig: LayerProps = {
    type: 'group',
    title: 'Geophysical Data',
    visible: true,
    layers: [
        mtStationsLayerConfig,
        geothermalTEMLayerConfig,
        gravityStationsLayerConfig,
        pacesLegacyLayerConfig,
        cgbaBouguerCOGConfig,
    ]
}

const geothermalWellsandSpringsConfig: LayerProps = {
    type: 'group',
    title: 'Geothermal Resources',
    visible: false,
    layers: [
        heatflowLayerConfig,
        geothermalUseLayerConfig,
        geothermalWellsJoinsConfig,
        geothermalSpringsJoinsConfig,
        geothermalWellsWMSConfig,
        geothermalKgraLayerConfig,
        deepSedimentaryBasinsLayerConfig,
        potentialResourcesLayerConfig,

    ]
}

const geologicalInformationConfig: LayerProps = {
    type: 'group',
    title: 'Geological Information',
    visible: false,
    layers: [
        qFaultsWMSConfig,
        faultsWMSConfig,
        seamlessGeolunitsWMSConfig,
    ]
}

const infrastructureAndLandUseConfig: LayerProps = {
    type: 'group',
    title: 'Infrastructure and Land Use',
    visible: false,
    layers: [
        powerplantsConfig,
        roadsWMSConfig,
        railroadsWMSConfig,
        transmissionLinesWMSConfig,
        SITLAConfig
    ]
}

const layersConfig: LayerProps[] = [
    geophysicalDataConfig,
    geothermalWellsandSpringsConfig,
    geologicalInformationConfig,
    infrastructureAndLandUseConfig,
];

export default layersConfig;