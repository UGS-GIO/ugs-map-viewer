import { ENERGY_MINERALS_WORKSPACE, HAZARDS_WORKSPACE, MAPPING_WORKSPACE, PROD_GEOSERVER_URL } from "@/lib/constants";
import { LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";
import { toTitleCase, toSentenceCase } from "@/lib/utils";
import { GeoJsonProperties } from "geojson";


// Roads WMS Layer
const roadsLayerName = 'ccus_majorroads';
const roadsWMSTitle = 'Major Roads';
const roadsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: roadsWMSTitle,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${roadsLayerName}`,
            popupEnabled: false,
            queryable: false,
            popupFields: {
                'Name': { field: 'fullname', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
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
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${railroadsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'railroad', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
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
    crs: 'EPSG:26912',
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
    visible: true,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${MAPPING_WORKSPACE}:${seamlessGeolunitsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Unit': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
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
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${MAPPING_WORKSPACE}:${faultsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Description': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
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
                    transform: (value: string | null) => {
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
    crs: 'EPSG:26912',
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
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        if (!props) {
                            return 'No USGS link available';
                        }
                        return props['usgs_link'] || 'No USGS link available';
                    }
                },
            },
            linkFields: {
                'usgs_link': {
                    transform: (usgsLink: unknown) => {
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
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${geothermalPowerplantsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'plant', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Capacity (MW)': { field: 'capacity_mw', type: 'number' },
                'Operator': { field: 'operator', type: 'string' },
                'City': { field: 'city', type: 'string' },
                'County': { field: 'county', type: 'string' },
            },
        }
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
        faultsWMSConfig,
        seamlessGeolunitsWMSConfig
    ]
}

const layersConfig: LayerProps[] = [
    geologicalInformationConfig,
    infrastructureAndLandUseConfig,
];

export default layersConfig;