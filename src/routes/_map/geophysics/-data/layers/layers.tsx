import { ENERGY_MINERALS_WORKSPACE, HAZARDS_WORKSPACE, MAPPING_WORKSPACE, PROD_GEOSERVER_URL } from "@/lib/constants";
import { ArcGISMapServerLayerProps, LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";
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

// Geothermal Power Plants WMS Layer
const geothermalPowerplantsLayerName = 'ccus_geothermalpowerplants';
const geothermalPowerplantsWMSTitle = 'Geothermal Power Plants';
const geothermalPowerplantsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: geothermalPowerplantsWMSTitle,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${geothermalPowerplantsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'plant', type: 'string', transform: (value) => toTitleCase(value || '') },
                'Capacity (MW)': { field: 'capacity_mw', type: 'number' },
                'Operator': { field: 'operator', type: 'string' },
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
                'PH': { field: 'ph', type: 'string' },
                'Conductivity (microsiemens)': { field: 'cond', type: 'string' },
                'Sodium': { field: 'na', type: 'string' },
                'Calcium (mg/l)': { field: 'ca', type: 'string' },
                'Magnesium (mg/l)': { field: 'mg', type: 'string' },
                'Silica (mg/l)': { field: 'sio2', type: 'string' },
                'Boron (mg/l)': { field: 'b', type: 'string' },
                'Lithium (mg/l)': { field: 'li', type: 'string' },
                'Bicarbonate (mg/l)': { field: 'hco3', type: 'string' },
                'Sulfer (mg/l)': { field: 'so4', type: 'string' },
                'Chlorine (mg/l)': { field: 'cl', type: 'string' },
                'TDS Measured (mg/l)': { field: 'tdsm', type: 'string' },
                'TDS Calculated (mg/l)': { field: 'tdsc', type: 'string' },
                'Cat/Anion Charge Balance': { field: 'chgbal', type: 'string' },
            },
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
const gravityStationsLayeTitle = 'Modern Gravity Stations';
const gravityStationsLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: gravityStationsLayeTitle,
    visible: true,
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
const geothermalTEMLayerTitle = 'Transient Electromagnetic Data (TEM)';
const geothermalTEMLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: geothermalTEMLayerTitle,
    visible: true,
    customLayerParameters: { cql_filter: "dataquality IN ('1','2')" },
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

// CGBA Gravity Anomalies — continuous raster served via WMS.
const cgbaRasterLayerName = 'enmin_geophysics_gravanomalyraster_current';
const cgbaBouguerRasterTitle = 'Complete Bouguer Gravity Anomaly';
const cgbaBouguerRasterConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: cgbaBouguerRasterTitle,
    visible: false,
    opacity: 0.9,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${cgbaRasterLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                // empty in favor of using the rasterSource for popup values
            },
            rasterSource: {
                url: `${PROD_GEOSERVER_URL}/wms`,
                headers: {
                    "Accept": "application/json",
                    "Cache-Control": "no-cache",
                },
                layerName: `${ENERGY_MINERALS_WORKSPACE}:${cgbaRasterLayerName}`,
                valueField: "GRAY_INDEX",
                valueLabel: "Gravity Anomaly",
                transform: (value: number) => `${value} mGal`,
            },
        },
    ],
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
        cgbaBouguerRasterConfig,
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
        geothermalPowerplantsWMSConfig,
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