import { Link } from "@/components/ui/link";
import { ENERGY_MINERALS_WORKSPACE, GEN_GIS_WORKSPACE, HAZARDS_WORKSPACE, MAPPING_WORKSPACE, PROD_GEOSERVER_URL, PROD_POSTGREST_URL } from "@/lib/constants";
import { LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";
import { addThousandsSeparator, toTitleCase, toSentenceCase } from "@/lib/utils";
import { GeoJsonProperties } from "geojson";

// GeoRegions WMS Layer
const basinNamesLayerName = 'basin_names';
const basinNamesWMSTitle = 'Geo-region Carbon Storage Ranking';
const basinNamesWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: basinNamesWMSTitle,
    visible: true,
    opacity: 0.3,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${basinNamesLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
                'Description': { field: 'description', type: 'string' },
                'Report Link': { field: 'reportlink', type: 'string' },
                'Ranked Formation': { field: 'rankedformation', type: 'string' },
                'Rank': {
                    type: 'custom',
                    field: 'ranknumber',
                    transform: (properties: GeoJsonProperties | null | undefined): string => {
                        if (!properties) {
                            return '';
                        }

                        const rankNumber = properties.ranknumber;
                        const rankingText = properties.ranking;

                        if (rankNumber === null || rankNumber === undefined || rankNumber === 0) {
                            return "Coming Soon";
                        }

                        if (rankingText) {
                            return rankingText;
                        } else {
                            return String(rankNumber);
                        }
                    }
                },
            },
            colorCodingMap: {
                'ranknumber': (value: string | number) => {
                    const strValue = String(value).toLowerCase();
                    if (strValue.includes("coming soon")) return "#ABA290";
                    if (strValue.includes("excellent")) return "#3DC200";
                    if (strValue.includes("moderate")) return "#FFE700";
                    if (strValue.includes("limited")) return "#FF7E00";
                    return "#808080";
                }
            },
            colorCodingMode: 'background',
        },
    ],
};

// Oil and Gas Fields WMS Layer
const oilGasFieldsLayerName = 'oilgasfields';
const oilGasFieldsWMSTitle = 'Oil and Gas Fields';
const oilGasFieldsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: oilGasFieldsWMSTitle,
    visible: false,
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

// Pipelines WMS Layer
const pipelinesLayerName = 'pipelines';
const pipelinesWMSTitle = 'Pipelines';
const pipelinesWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: pipelinesWMSTitle,
    visible: false,
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

// SCO2 Grid Summary WMS Layer (aggregated - one row per grid cell, capacity color + cost labels)
const sco2GridSummaryLayerName = 'sco2_grid_summary';
const sco2GridSummaryWMSTitle = 'Statewide Storage Resource Estimates';
const sco2GridSummaryWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: sco2GridSummaryWMSTitle,
    visible: true,
    opacity: 0.75,
    crs: 'EPSG:4326',
    bivariateLegend: { xLabel: 'Cost', yLabel: 'Capacity' },
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${sco2GridSummaryLayerName}`,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'State': { field: 'state', type: 'string' },
                'Geo Regions': { field: 'geo_regions', type: 'string' },
                'Formation Count': { field: 'formation_count', type: 'number' },
                'Total Capacity (Mt CO₂)': {
                    field: 'capacity_mtco2',
                    type: 'number',
                    transform: (v) => v != null ? addThousandsSeparator(v.toFixed(1)) : null,
                },
                'Capacity Rank': {
                    field: 'capacity_percentile',
                    type: 'number',
                    description: 'Relative to all evaluated grid cells. High = top third, Mid = middle third, Low = bottom third by total storage capacity.',
                    transform: (v) => {
                        if (v == null) return null;
                        const label = v >= 0.67 ? 'High' : v >= 0.33 ? 'Mid' : 'Low';
                        const pct = Math.round(v * 100);
                        return `${label} (top ${pct}%)`;
                    },
                },
                'Avg Cost ($/tCO₂)': {
                    field: 'avg_cost_per_tco2',
                    type: 'number',
                    decimalPlaces: 2,
                },
                'Cost Rank': {
                    field: 'cost_percentile',
                    type: 'number',
                    description: 'Relative to all evaluated grid cells. Low = cheapest third, Mid = middle third, High = most expensive third by capacity-weighted average cost.',
                    transform: (v) => {
                        if (v == null) return null;
                        const label = v >= 0.67 ? 'Low' : v >= 0.33 ? 'Mid' : 'High';
                        const pct = Math.round((1 - v) * 100);
                        return `${label} (top ${pct}% cost)`;
                    },
                },
            },
            relatedTables: [
                {
                    fieldLabel: 'Formation Details',
                    matchingField: 'basegrid_id',
                    targetField: 'id50km',
                    url: `${PROD_GEOSERVER_URL}/wfs`,
                    headers: {},
                    fetchMode: 'wfs',
                    wfsTypeName: `${ENERGY_MINERALS_WORKSPACE}:sco2_draft_13aug24`,
                    sortBy: 'capacity_mtco2',
                    sortDirection: 'desc',
                    displayAs: 'table',
                    displayFields: [
                        { field: 'name', label: 'Formation' },
                        { field: 'capacity_mtco2', label: 'Capacity (Mt CO₂)', format: 'number' },
                        { field: 'storage_cost_doll_per_tco2', label: 'Cost ($/tCO₂)', format: 'number' },
                    ],
                },
            ],
        },
    ],
};

// Rivers WMS Layer
const riversLayerName = 'rivers';
const riversWMSTitle = 'Major Rivers';
const riversWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: riversWMSTitle,
    visible: false,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${GEN_GIS_WORKSPACE}:${riversLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Water Right Area': { field: 'drainage_a', type: 'number' }
            },
        },
    ],
};

// Roads WMS Layer
const roadsLayerName = 'ccus_majorroads';
const roadsWMSTitle = 'Major Roads';
const roadsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: roadsWMSTitle,
    visible: false,
    crs: 'EPSG:3857',
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

const qFaultsLayerName = 'hazards_qfaults_current';
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
                                href: 'https://geology.utah.gov/apps/rockcore/'
                            }
                        ];
                    }
                }
            }
        }
    ],
};

// CO2 Sources WMS Layer
const co2SourcesLayerName = 'ccus_co2_sources';
const co2SourcesWMSTitle = 'CO₂ Sources';
const co2SourcesWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: co2SourcesWMSTitle,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${co2SourcesLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Facility Name': { field: 'facility_name', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Description': { field: 'description', type: 'string' },
                'Greenhouse Gas Emissions': {
                    field: 'ghg_quantity__metric_tons_co2e_',
                    type: 'string',
                    transform: (value: string | null) => {
                        if (value === null) {
                            return 'No Data';
                        }
                        return `${addThousandsSeparator(value)} mtCO₂e`;
                    }
                },
                'Reporting Year': { field: 'reporting_year', type: 'string' },
                '': {
                    field: 'inventory_link',
                    type: 'custom',
                    transform: (() => 'View data from the U.S. Environmental Protection Agency')
                },
            },
            linkFields: {
                'inventory_link': {
                    transform: (value: string | null) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://www.epa.gov/ghgemissions/sources-greenhouse-gas-emissions/'
                            }
                        ];
                    }
                }
            }
        }
    ],
};

const wildernessStudyAreasLayerName = 'ccus_wsa';
const wildernessStudyAreasWMSTitle = 'Wilderness Study Areas';
const wildernessStudyAreasWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: wildernessStudyAreasWMSTitle,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${wildernessStudyAreasLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'nlcs_name', type: 'string' },
                'Type': { field: 'wsa_values', type: 'string' },
                'NLCS ID': { field: 'nlcs_id', type: 'string' },
                'WSA Number ': { field: 'wsa_number', type: 'string' }
            },
        }
    ],
};

const sitlaReportsLayerName = 'ccus_sitla_reports';
const sitlaReportsWMSTitle = 'CO₂ Storage Potential on SITLA Blocks';
const sitlaReportsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: sitlaReportsWMSTitle,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${sitlaReportsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'new_block_', type: 'string' },
                'Ranking': {
                    field: 'ranking', type: 'string',
                    transform: (value: string | null) => {
                        if (value === 'None' || value === null) {
                            return 'Not Evaluated';
                        }
                        // Strip leading number (e.g., "4.0 Good Potential" -> "Good Potential")
                        return value.replace(/^\d+(\.\d+)?\s*/, '');
                    }
                },
                'Description': { field: 'description', type: 'string' },
                '': { field: 'linktoreport', type: 'string', transform: (value: string | null) => value },
            },
            colorCodingMap: {
                'ranking': (value: string | number) => {
                    const strValue = String(value).toLowerCase();
                    if (strValue.includes("excellent")) return "#3DC200";
                    if (strValue.includes("good")) return "#CFFF00";
                    if (strValue.includes("some")) return "#FFE700";
                    if (strValue.includes("limited")) return "#FF7E00";
                    return "#CDCDCD"; // Not Evaluated
                }
            },
            colorCodingMode: 'background',
            linkFields: {
                'linktoreport': {
                    transform: (value: string) => {
                        if (value === 'None') {
                            const transformedValues = {
                                href: '',
                                label: 'Not currently available'
                            };
                            return [transformedValues];
                        } else {
                            const transformedValues = {
                                href: value,
                                label: `Report`
                            };
                            return [transformedValues];
                        }
                    }
                },
            }
        }
    ],
};

const ccsExclusionAreasLayerName = 'ccus_noccuszone';
const ccsExclusionAreasWMSTitle = 'CCS Exclusion Areas';
const ccsExclusionAreasWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: ccsExclusionAreasWMSTitle,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${ccsExclusionAreasLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Notes': { field: 'notes', type: 'string' },

            }
        }
    ],
};


const ccusProjectsLayerName = 'ccus_projects_current';
const ccusProjectsWMSTitle = 'CCUS Projects';
const ccusProjectsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: ccusProjectsWMSTitle,
    visible: true,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${ccusProjectsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Project Name': { field: 'generalregionname', type: 'string' },
                'Timeline': { field: 'timeline', type: 'string' },
                'Project Summary': { field: 'projectsummary', type: 'string' },
                'Reservoir Investigated': { field: 'reservoirinvestigated', type: 'string' },
                '': { field: 'link', type: 'string', transform: (value: string | null) => value },
            },
            linkFields: {
                'link': {
                    transform: (value: string) => {
                        if (!value) {
                            return [{ label: 'Not available', href: '' }];
                        }
                        return [{ label: 'More Information', href: value }];
                    }
                }
            }
        }
    ],
};

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

// Geochemistry Well Sites WMS Layer
const geochemWellSitesLayerName = 'enmin_ccus_geochemistry_current';
const geochemWellSitesWMSTitle = 'Geochemistry Well Sites';
const geochemWellSitesWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: geochemWellSitesWMSTitle,
    visible: false,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${geochemWellSitesLayerName}`,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Well Name': { field: 'wellname', type: 'string' },
                'UWI': { field: 'uwi', type: 'string' },
                'Operator': { field: 'operator', type: 'string' },
                'Data Type': { field: 'datatype', type: 'string' },
                'Geo-region': { field: 'georegion', type: 'string' },
                'Field Name': { field: 'fieldname', type: 'string' },
                'County': { field: 'section', type: 'string' },
                'Location': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        const sec = props?.['section_1'];
                        const twp = props?.['township'];
                        const tDir = props?.['t_direction'];
                        const rng = props?.['range'];
                        const rDir = props?.['r_direction'];
                        if (!twp && !rng) return '';
                        const parts: string[] = [];
                        if (sec) parts.push(`Sec ${sec}`);
                        if (twp) parts.push(`T${twp}${tDir || ''}`);
                        if (rng) parts.push(`R${rng}${rDir || ''}`);
                        return parts.join(', ');
                    }
                },
            },
            relatedTables: [
                {
                    fieldLabel: 'Geochemistry Data',
                    matchingField: 'uwi',
                    targetField: 'uwi',
                    url: PROD_POSTGREST_URL + '/ccus_geochem_data',
                    headers: {
                        "Accept-Profile": 'emp',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'formation', label: 'Formation' },
                        { field: 'depth_top_interval', label: 'Depth (ft)' },
                        { field: 'porosity_percent', label: 'Porosity (%)' },
                        { field: 'perm_md_klink', label: 'Permeability (mD)' },
                        { field: 'salinity_ppm', label: 'Salinity (ppm)' },
                    ],
                    sortBy: 'depth_top_interval',
                    sortDirection: 'asc',
                    displayAs: 'table'
                },
            ],
        },
    ],
};


// Wells and Springs with Joins WMS Layer
const geothermalWellsJoinsName = 'enmin_geothermal_ingenious_wellfeatures_current';
const geothermalWellsJoinsTitle = 'Geothermal Wells';
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
                'Has Temperature Data': { field: 'hastemperaturedata', type: 'string', transform: (value: string | null) => {
                        if (value === '1') return 'YES'
                        return 'NO'
                    },
                },
                'Has Geochemistry Data': { field: 'hasgeochemistrydata', type: 'string', transform: (value: string | null) => {
                        if (value === '1') return 'YES'
                        return 'NO'
                    },
                },
                'Sort ID': { field: 'sortid', type: 'string' },
                '': { field: 'geothermal_link', type: 'custom',  transform: (() => 'Geothermal Data Repository')},
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
const geothermalSpringsJoinsTitle = 'Geothermal Springs';
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
                'Has Temperature Data': { field: 'hastemperaturedata', type: 'string', transform: (value: string | null) => {
                        if (value === '1') return 'YES'
                        return 'NO'
                    },
                },
                'Has Geochemistry Data': { field: 'hasgeochemistrydata', type: 'string', transform: (value: string | null) => {
                        if (value === '1') return 'YES'
                        return 'NO'
                    },
                },
                'Sort ID': { field: 'sortid', type: 'string' },
                '': { field: 'geothermal_link', type: 'custom',  transform: (() => 'Geothermal Data Repository')},
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

// Non-Petroleum Well Catalogue Data
/*
const nonPetroleumCatLayerName = 'nwpd_nonpetroleumwellcatalogwells';
const nonPetroleumCatLayerTitle = 'Non-Petroleum Wells';
const nonPetroleumCatLayerConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: nonPetroleumCatLayerTitle,
    visible: false,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${nonPetroleumCatLayerName}`,
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
                        const townNum = props?.['town_num'];
                        const townDir = props?.['town_dir'];
                        const rangeNum = props?.['range_num'];
                        const rangeDir = props?.['range_dir'];
                        const sect = props?.['sect'];
                        return `${townNum}${townDir} ${rangeNum}${rangeDir} Section ${sect}`;
                    }
                },
                'Field/Area': { field: 'field_area', type: 'string' },
                'Purpose': { field: 'purpose', type: 'string' },
                'Depth': { field: 'depth', type: 'string' }
            },
        },
    ],
};
*/


// Energy and Minerals Group Layer
const ccsResourcesConfig: LayerProps = {
    type: 'group',
    title: 'Carbon Storage Resources',
    visible: true,
    layers: [
        sco2GridSummaryWMSConfig,
        basinNamesWMSConfig,
        co2SourcesWMSConfig,
        sitlaReportsWMSConfig,
        ccsExclusionAreasWMSConfig,
        ccusProjectsWMSConfig
    ]
}

const infrastructureAndLandUseConfig: LayerProps = {
    type: 'group',
    title: 'Infrastructure and Land Use',
    visible: false,
    layers: [
        geothermalPowerplantsWMSConfig,
        pipelinesWMSConfig,
        riversWMSConfig,
        roadsWMSConfig,
        railroadsWMSConfig,
        transmissionLinesWMSConfig,
        wildernessStudyAreasWMSConfig,
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
        seamlessGeolunitsWMSConfig,
    ]
}
const subsurfaceDataConfig: LayerProps = {
    type: 'group',
    title: 'Subsurface Data',
    visible: true,
    layers: [
        wellWithTopsWMSConfig,
        coresAndCuttingsWMSConfig,
        oilGasFieldsWMSConfig,
        geochemWellSitesWMSConfig,
        geothermalWellsWMSConfig,
        geothermalSpringsJoinsConfig,
        geothermalWellsJoinsConfig,
    ]
}



const layersConfig: LayerProps[] = [
    ccsResourcesConfig,
    subsurfaceDataConfig,
    geologicalInformationConfig,
    infrastructureAndLandUseConfig
];

export default layersConfig;