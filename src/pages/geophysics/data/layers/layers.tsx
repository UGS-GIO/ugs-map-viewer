import { ENERGY_MINERALS_WORKSPACE, HAZARDS_WORKSPACE, MAPPING_WORKSPACE, PROD_GEOSERVER_URL } from "@/lib/constants";
import { LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";
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
                        // the value is a url that needs to be transformed into href and label for the link
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

// SITLA Land Ownership Layer
const SITLAConfig: LayerProps = {
    type: 'map-image',
    url: 'https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership_WM/MapServer',
    opacity: 0.5,
    title: 'Land Ownership',
    options: {
        title: 'Land Ownership',
        elevationInfo: [{ mode: 'on-the-ground' }],
        visible: false,
        sublayers: [{
            id: 0,
            visible: true,
        }],
    },
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
                        // the value is a url that needs to be transformed into href and label for the link
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


const qFaultsLayerName = 'quaternaryfaults_current';
const qFaultsWMSTitle = 'Hazardous (Quaternary age) Faults';
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
                '': {
                    field: 'usgs_link',
                    type: 'custom',
                    transform: (value) => {
                        if (!value) {
                            return 'No USGS link available';
                        }
                        return value['usgs_link'] || 'No USGS link available';
                    }
                },
            },
            linkFields: {
                'usgs_link': {
                    transform: (usgsLink) => {
                        if (!usgsLink || usgsLink === 'No USGS link available') {
                            return [{
                                label: 'No USGS link available',
                                href: ''
                            }];
                        }
                        return [{
                            label: 'Detailed Report',
                            href: `${usgsLink}`
                        }];
                    }
                }
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
    visible: false,
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
const geothermalWellsWMSTitle = 'Geothermal Wells & Springs';
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
                        
                        // Convert to title case if they are strings
                        const formattedStart = typeof regionl === 'string' ? toTitleCase(regionl) : regionl;
                        const formattedEnd = typeof countyl === 'string' ? toTitleCase(countyl) : countyl;
                        
                        return `${formattedStart}, ${formattedEnd}`;
                    }
                },
                'Well/Spring Name': { field: 'source', type: 'string' },
                'UGS Name': { field: 'idname', type: 'string' },
                'Type': { field: 'type', type: 'string' },
                'Temperature': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const bht = props?.['temp'];
                        return `${bht} °C`;
                    }
                },
                'Class': { field: 'class', type: 'string' },
                'Depth of Well': { field: 'depth', type: 'string' },
                'Flow': { field: 'flow', type: 'string' },
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
                'Date': { field: 'date', type: 'string' },
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
const heatflowLayeTitle = 'Heat Flow Measurements';
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
                'Uncorrected Gradient (degrees/m)': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const bht = props?.['un_grad_c_km'];
                        return `${bht} °C`;
                    }
                },
                'Uncorrected Heatflow': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const bht = props?.['un_hf_mw_m2'];
                        return `${bht} mW`;
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


// gravity stations
const gravityStationsLayeName = 'enmin_geophysics_ugsobsgrav_current';
const gravityStationsLayeTitle = 'Gravity Stations';
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
                'OGC Id': { field: 'ogc_fid', type: 'string' },
                'Location (WGS84)': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const depthStart = props?.['latitude_wgs84'];
                        const depthEnd = props?.['longitude_wgs84'];
                        return `${depthStart} , ${depthEnd}`;
                    }
                },
                'Date': { field: 'date', type: 'string' },
                'Observed Measurement': { field: 'observed', type: 'string' },
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
                'Temperature': { field: 'temp_c', type: 'string' },
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
const deepSedimentaryBasinsLayerTitle = 'Deep Sedimentary Basins';
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

// deep sedimentary basins
const potentialResourcesLayerName = 'geothermal_potentialresourcearea_current';
const potentialResourcesLayerTitle = 'Potential Resource Areas';
const potentialResourcesLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: potentialResourcesLayerTitle,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${potentialResourcesLayerName}`,
            popupEnabled: false,
            queryable: false,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
            },
        },
    ],
};

// Known Geothermal Resource Areas (KGRA)
const geothermalKgraLayerName = 'geothermal_kgra_current';
const geothermalKgraLayerTitle = 'Known Geothermal Resource Areas (KGRA)';
const geothermalKgraLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: geothermalKgraLayerTitle,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${geothermalKgraLayerName}`,
            popupEnabled: false,
            queryable: false,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
            },
        },
    ],
};

// Known Geothermal Resource Areas (KGRA)
const nonPetrolWellLayerName = 'nwpd_nonpetroleumwellcatalogwells';
const nonPetrolWellLayerTitle = 'Non-Petroleum Well Data';
const nonPetrolWellLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: nonPetrolWellLayerTitle,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${nonPetrolWellLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'well_name', type: 'string' },
                'API/UWI': { field: 'uwi', type: 'string' },
                'Operator': { field: 'operator', type: 'string' },
                'County': { field: 'county', type: 'string' },
                'Location': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
                        const a = props?.['town_num'];
                        const b = props?.['town_dir'];
                        const c = props?.['range_num'];
                        const d = props?.['range_dir'];
                        const e = props?.['sect'];
                        return `${a} ${b} ${c} ${d} Section ${e}`;
                    }
                },
                'Field/Area': { field: 'field_area', type: 'string' },
                'Purpose': { field: 'purpose', type: 'string' },
                'Depth:': { field: 'depth', type: 'string' },
                'Well Logs:': { field: 'well_logs', type: 'string' },
                'Reports:': { field: 'reports', type: 'string' },
/*              'Reports': {
                    field: 'custom',
                    type: 'custom',
                    transform: transformReports
                }, */
            },
        },
    ],
};


// Transform function for reports field
/* 
const transformReports = (props: any) => {
  const reportsString = props?.['reports'];
  return <ReportsList reportsString={reportsString} />;
}; */


// ingqFaults WMS Layer
const ingqFaultsLayerName = 'mart_geothermal_qfaults_ingenious_current';
const ingqFaultsWMSTitle = 'Great Basin Faults (INGENIOUS Project)';
const ingqFaultsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: ingqFaultsWMSTitle,
    visible: false,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${ingqFaultsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
                'Slip Rate': { field: 'sliprate_n', type: 'string' },
                'Recency N': { field: 'recency_n', type: 'string' },
                'Recency CI': { field: 'recency_ci', type: 'string' },
                'Age': { field: 'age', type: 'string' },
                'Mapped Scale': { field: 'mappedscal', type: 'string' },
                'CFM URL': { field: 'cfm_url', type: 'string' },
                'Geometry': { field: 'geometry_c', type: 'string' },
                'Dip Direction': { field: 'dipdirect', type: 'string' },
                'FType': { field: 'ftype_', type: 'string' },
                'Comments': { field: 'comments', type: 'string' },
                'Notes': { field: 'notes', type: 'string' }
            },
        },
    ],
};



const infrastructureAndLandUseConfig: LayerProps = {
    type: 'group',
    title: 'Infrastructure and Land Use',
    visible: false,
    layers: [
        geothermalPowerplantsWMSConfig,
        roadsWMSConfig,
        railroadsWMSConfig,
        transmissionLinesWMSConfig,
        SITLAConfig,
    ]
}

const geologicalInformationConfig: LayerProps = {
    type: 'group',
    title: 'Geological Information',
    visible: false,
    layers: [
        qFaultsWMSConfig,
        ingqFaultsWMSConfig,
        faultsWMSConfig,
        seamlessGeolunitsWMSConfig
    ]
}

const geothermalWellsandSpringsConfig: LayerProps = {
    type: 'group',
    title: 'Geothermal Resources',
    visible: true,
    layers: [
        geothermalWellsWMSConfig,
        heatflowLayerConfig
    ]
}

const geophysicalDataConfig: LayerProps = {
    type: 'group',
    title: 'Geophysical Data',
    visible: true,
    layers: [
        gravityStationsLayerConfig,
        geothermalUseLayerConfig,
        potentialResourcesLayerConfig,
        deepSedimentaryBasinsLayerConfig,
        geothermalKgraLayerConfig,
        nonPetrolWellLayerConfig
    ]
}

const layersConfig: LayerProps[] = [
    geothermalWellsandSpringsConfig,
    geophysicalDataConfig,
    geologicalInformationConfig,
    infrastructureAndLandUseConfig,
];

export default layersConfig;