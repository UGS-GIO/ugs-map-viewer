import { Link } from "@/components/ui/link";
import { ENERGY_MINERALS_WORKSPACE, MAPPING_WORKSPACE, PROD_GEOSERVER_URL, PROD_POSTGREST_URL } from "@/lib/constants";
import { LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";
import { toTitleCase } from "@/lib/utils";
import { GeoJsonProperties } from "geojson";
import { addThousandsSeparator } from "@/lib/utils";


export const wellWithTopsLayerName = 'wellswithtops_hascore';
export const wellWithTopsWMSTitle = 'Wells Database';
const wellWithTopsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: wellWithTopsWMSTitle,
    visible: true,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${wellWithTopsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'API': { field: 'api', type: 'string' },
                'Well Name': { field: 'wellname', type: 'string' },
                'Disclaimer': {
                    field: 'Formation Tops Disclaimer',
                    type: 'custom',
                    transform: () => 'Formation top information and LAS file availability is provided as-is and may not be fully complete or accurate.'
                }
            },
            relatedTables: [
                {
                    fieldLabel: 'Formation Tops',
                    matchingField: 'api',
                    targetField: 'api',
                    url: PROD_POSTGREST_URL + '/view_wellswithtops_hascore',
                    headers: {
                        "Accept-Profile": 'emp',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'formation_alias', label: 'Formation Name' },
                        { field: 'formation_depth', label: 'Formation Depth (ft)', format: 'number' },
                    ],
                    sortBy: 'formation_depth',
                    sortDirection: 'asc',
                    displayAs: 'table'
                },
                {
                    fieldLabel: 'LAS File Information',
                    matchingField: 'display_api',
                    targetField: 'api',
                    url: PROD_POSTGREST_URL + '/ccus_las_display_view',
                    headers: {
                        "Accept-Profile": 'emp',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'display_description', label: 'Description', transform: (value: string | null) => value !== '' ? value : 'No Data' },
                        { field: 'display_field_name', label: 'Field Name', transform: (value: string | null) => value !== '' ? value : 'No Data' },
                        { field: 'display_well_status', label: 'Well Status', transform: (value: string | null) => value !== '' ? value : 'No Data' },
                        { field: 'display_well_type', label: 'Well Type', transform: (value: string | null) => value !== '' ? value : 'No Data' },
                        {
                            field: 'source', label: 'Source', transform: (value: string | null) => {
                                if (value === 'DOGM') {
                                    return <Link to="https://dataexplorer.ogm.utah.gov/">Utah Division of Oil, Gas and Mining</Link>
                                } else if (value === 'UGS') {
                                    return <>Utah Geological Survey - contact <Link to="mailto:gstpierre@utah.gov">gstpierre@utah.gov</Link></>
                                }
                                return value !== '' ? value : 'No Data';
                            }
                        }
                    ],
                    displayAs: 'table'
                }
            ]
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
            crs: 'EPSG:26912',
        }],
    },
};

// Utah counties
const utCountiesConfig: LayerProps = {
    type: 'map-image',
    url: 'https://services.arcgis.com/ZzrwjTRez6FJiOq4/ArcGIS/rest/services/Core_Locations_Supporting_Data/FeatureServer/1',
    opacity: 0.5,
    title: 'Utah Counties',
    options: {
        title: 'Utah Counties',
        elevationInfo: [{ mode: 'on-the-ground' }],
        visible: true,
        sublayers: [{
            id: 0,
            visible: true,
            crs: 'EPSG:26912',
        }],
    },
};



// Utah township & ranges
const utTownshipRangesConfig: LayerProps = {
    type: 'map-image',
    url: 'https://services.arcgis.com/ZzrwjTRez6FJiOq4/ArcGIS/rest/services/Core_Locations_Supporting_Data/FeatureServer/3',
    opacity: 0.5,
    title: 'Utah Township & Ranges',
    options: {
        title: 'Utah Township & Ranges',
        elevationInfo: [{ mode: 'on-the-ground' }],
        visible: true,
        sublayers: [{
            id: 0,
            visible: true,
            crs: 'EPSG:26912',
        }],
    },
};

// Oil and Gas Fields WMS Layer
const oilGasFieldsLayerName = 'oilgasfields';
const oilGasFieldsWMSTitle = 'Oil and Gas Fields';
const oilGasFieldsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: oilGasFieldsWMSTitle,
    visible: true,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${oilGasFieldsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Field Name': { field: 'field_name', type: 'string' },
                'Field Type': { field: 'field_type', type: 'string' },
                'Producing Formations': { field: 'prod_formations', type: 'string' },
                'Reservoir Age': { field: 'reservoir_rocks', type: 'string' },
                'Status': { field: 'status', type: 'string' }
            },
        },
    ],
};


// Seamless Geological Units WMS Layer
const seamlessGeolunitsLayerName = 'mapping_geolunits_500k';
export const seamlessGeolunitsWMSTitle = 'Geologic Units (500k)';
const seamlessGeolunitsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: seamlessGeolunitsWMSTitle,
    opacity: 0.5,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${MAPPING_WORKSPACE}:${seamlessGeolunitsLayerName}`,
            popupEnabled: true,
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

// Pipelines WMS Layer
const pipelinesLayerName = 'pipelines';
const pipelinesWMSTitle = 'Pipelines';
const pipelinesWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: pipelinesWMSTitle,
    visible: true,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${pipelinesLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Operator': { field: 'operator', type: 'string' },
                'Commodity': { field: 'commodity', type: 'string' },
                'Acronym': { field: 'acronym', type: 'string' },
                'Code Remarks': { field: 'coderemarks', type: 'string' }
            },
        },
    ],
};


const coresAndCuttingsLayerName = 'cores';
const coresAndCuttingsWMSTitle = 'Cores and Cuttings';
const coresAndCuttingsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: coresAndCuttingsWMSTitle,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${coresAndCuttingsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'API': { field: 'apishort', type: 'string' },
                'UWI': { field: 'uwi', type: 'string' },
                'Well Name': { field: 'well_name', type: 'string' },
                'Sample Types': {
                    field: 'all_types', type: 'string', transform: (value: string | null) => {
                        if (!value) return 'No Data';
                        const lower = value.toLowerCase();

                        // Map raw sample types to simplified categories
                        const coreTypes = /\b(core|butts?|slabs?|skeletonized core|sidewall)\b/;
                        const cuttingsTypes = /\b(chips?|core chips?|cuttings?)\b/;
                        const samplesTypes = /\b(samples?|outcrop samples?)\b/;
                        const displayTypes = /\bdisplay\b/;

                        const categories: string[] = [];
                        if (coreTypes.test(lower)) categories.push('Core');
                        if (cuttingsTypes.test(lower)) categories.push('Cuttings');
                        if (samplesTypes.test(lower)) categories.push('Samples');
                        if (displayTypes.test(lower)) categories.push('Display');

                        return categories.length ? categories.join(', ') : toTitleCase(value.replace(/,/g, ', '));
                    }
                },
                'Purpose': { field: 'purpose_description', type: 'string' },
                'Operator': { field: 'operator', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Depth': {
                    field: 'depth_display',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        const top = props?.['top_ft'];
                        const bottom = props?.['bottom_ft'];

                        if (top == null || bottom == null) {
                            return 'Depth N/A';
                        }
                        const topFt = addThousandsSeparator(top);
                        const bottomFt = addThousandsSeparator(bottom);
                        return `${topFt} - ${bottomFt} ft`;
                    }
                },
                'Formation at TD': { field: 'form_td', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Cored Formations': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        const formation = props?.['formation'] || '';
                        const coredFormation = props?.['cored_formation'] || '';

                        if (formation && coredFormation) {
                            return `${formation}, ${coredFormation}`;
                        } else if (formation) {
                            return `${formation}`;
                        } else if (coredFormation) {
                            return `${coredFormation}`;
                        } else {
                            return '';
                        }
                    }
                },
                '': {
                    field: 'inventory_link',
                    type: 'custom',
                    transform: (() => 'Utah Core Research Center Inventory')
                },
            },
            linkFields: {
                'inventory_link': {
                    transform: (value: string | null) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://geology.utah.gov/apps/subsurface/'
                            }
                        ];
                    }
                }
            }
        }
    ],
};

const ucrcWellsName = 'ucrc_wells_current';
const ucrcWellsTitle = 'UCRC Wells';
const ucrcWellsConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: ucrcWellsTitle,
    visible: true,
    opacity: 0.6,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${ucrcWellsName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'API': { field: 'api_number',       type: 'string' },
                'Well Name': { field: 'well_name',  type: 'string' },
                'Operator': { field: 'current_operator', type: 'string' },
                'Purpose': { field: 'purpose',  type: 'string' },
                'County':  { field: 'county',  type: 'string' },
                'Latitude': { field: 'latitude', type: 'number' },
                'Longitude': { field: 'longitude', type: 'number' },
                'Easting (NAD83)':  { field: 'easting',  type: 'number' },
                'Northing (NAD83)': { field: 'northing',  type: 'number' },
                'Township':  { field: 'township',  type: 'string' },
                'Range':  { field: 'range', type: 'string' },
                'Section': { field: 'section', type: 'string' },
            }
        }
    ]
};




const infrastructureAndLandUseConfig: LayerProps = {
    type: 'group',
    title: 'Infrastructure and Land Use',
    visible: true,
    layers: [
        SITLAConfig,
        utTownshipRangesConfig,
        utCountiesConfig,
        pipelinesWMSConfig,        
    ]
}

const geologicalInformationConfig: LayerProps = {
    type: 'group',
    title: 'Geological Information',
    visible: true,
    layers: [
        seamlessGeolunitsWMSConfig,
    ]
}
const subsurfaceDataConfig: LayerProps = {
    type: 'group',
    title: 'Subsurface Data',
    visible: false,
    layers: [
        ucrcWellsConfig,
        oilGasFieldsWMSConfig,
        coresAndCuttingsWMSConfig,
        wellWithTopsWMSConfig
    ]
}



const layersConfig: LayerProps[] = [
    subsurfaceDataConfig,
    geologicalInformationConfig,
    infrastructureAndLandUseConfig
];

export default layersConfig;