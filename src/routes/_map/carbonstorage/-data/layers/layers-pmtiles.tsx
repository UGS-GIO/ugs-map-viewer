import { Link } from "@/components/ui/link";
import { PROD_POSTGREST_URL } from "@/lib/constants";
import { LayerProps, PMTilesLayerProps } from "@/lib/types/mapping-types";
import { addThousandsSeparator, toTitleCase, toSentenceCase } from "@/lib/utils";
import { GeoJsonProperties } from "geojson";

// Shared PMTiles URLs for all carbon storage layers
const CARBONSTORAGE_PMTILES_URL = 'https://storage.googleapis.com/ut-dnr-ugs-bucket-server-prod/pmtiles/carbonstorage.pmtiles';
const CARBONSTORAGE_STYLE_URL = 'https://storage.googleapis.com/ut-dnr-ugs-bucket-server-prod/pmtiles/carbonstorage.json';

// SCO2 Layer - Statewide Storage Resource Estimates
const sco2LayerName = 'sco2_draft_13aug24';
const sco2Title = 'Statewide Storage Resource Estimates';
const sco2Config: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: sco2LayerName,
    title: sco2Title,
    visible: true,
    opacity: 0.8,
    sublayers: [
        {
            name: sco2LayerName,
            queryable: true,
            popupFields: {
                'Storage Resource Estimate (Mt CO₂)': {
                    field: 'capacity_mtco2',
                    type: 'number',
                    decimalPlaces: 2,
                },
                'Storage Cost ($/tCO₂)': {
                    field: 'storage_cost_doll_per_tco2',
                    type: 'number',
                    decimalPlaces: 2,
                },
                'Formation': { field: 'name', type: 'string' },
                'Thickness (m)': {
                    field: 'thickness_m',
                    type: 'number',
                    decimalPlaces: 2,
                },
                'Depth (m)': {
                    field: 'depth_m',
                    type: 'number',
                    decimalPlaces: 2,
                },
                'Permeability (md)': {
                    field: 'permeability_md',
                    type: 'number',
                    decimalPlaces: 2,
                },
                'Porosity (φ)': {
                    field: 'porosity',
                    type: 'number',
                    decimalPlaces: 2,
                },
                'Pressure (MPa)': {
                    field: 'pressure_mpa',
                    type: 'number',
                    decimalPlaces: 2,
                },
                'Temperature (C)': {
                    field: 'temperature_c',
                    type: 'number',
                    decimalPlaces: 1,
                },
                'Temperature Gradient (C/km)': {
                    field: 'temperature_gradient_c_per_km',
                    type: 'number',
                    decimalPlaces: 2,
                },
            },
        },
    ],
};

// Basin Names - Geo-region Carbon Storage Ranking
const basinNamesLayerName = 'basin_names';
const basinNamesTitle = 'Geo-region Carbon Storage Ranking';
const basinNamesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: basinNamesLayerName,
    title: basinNamesTitle,
    visible: true,
    opacity: 0.3,
    sublayers: [
        {
            name: basinNamesLayerName,
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
                            return `${rankNumber} - ${rankingText}`;
                        }
                        return String(rankNumber);
                    }
                },
            },
            colorCodingMap: {
                'ranknumber': (value: string | number) => {
                    if (value === "Coming Soon") return "#808080";
                    const rank = typeof value === 'number' ? value : parseInt(value, 10);
                    if (isNaN(rank)) return "#808080";
                    if (rank < 3) return "#FFA500";
                    if (rank < 6) return "#FFFF00";
                    if (rank >= 6) return "#00FF00";
                    return "#808080";
                }
            }
        },
    ],
};

// CO2 Sources
const co2SourcesLayerName = 'ccus_co2_sources';
const co2SourcesTitle = 'CO₂ Sources';
const co2SourcesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: co2SourcesLayerName,
    title: co2SourcesTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: co2SourcesLayerName,
            queryable: true,
            popupFields: {
                'Facility Name': { field: 'facility_name', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Description': { field: 'description', type: 'string' },
                'Greenhouse Gas Emissions': {
                    field: 'ghg_quantity__metric_tons_co2e_',
                    type: 'string',
                    transform: (value: string | null) => {
                        if (value === null) return 'No Data';
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
                    transform: (value: string | null) => [{
                        label: `${value}`,
                        href: 'https://www.epa.gov/ghgemissions/sources-greenhouse-gas-emissions/'
                    }]
                }
            }
        }
    ],
};

// SITLA Reports - CO2 Storage Potential on SITLA Blocks
const sitlaReportsLayerName = 'ccus_sitla_reports';
const sitlaReportsTitle = 'CO₂ Storage Potential on SITLA Blocks';
const sitlaReportsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: sitlaReportsLayerName,
    title: sitlaReportsTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: sitlaReportsLayerName,
            queryable: true,
            popupFields: {
                'Name': { field: 'new_block_', type: 'string' },
                'Ranking': {
                    field: 'ranking', type: 'string',
                    transform: (value: string | null) => {
                        if (value === 'None' || value === null) return 'Not evaluated';
                        return value;
                    }
                },
                'Description': { field: 'description', type: 'string' },
                '': { field: 'linktoreport', type: 'string', transform: (value: string | null) => value },
            },
            linkFields: {
                'linktoreport': {
                    transform: (value: string) => {
                        if (value === 'None') {
                            return [{ href: '', label: 'Not currently available' }];
                        }
                        return [{ href: value, label: 'Report' }];
                    }
                },
            }
        }
    ],
};

// CCS Exclusion Areas
const ccsExclusionAreasLayerName = 'ccus_noccuszone';
const ccsExclusionAreasTitle = 'CCS Exclusion Areas';
const ccsExclusionAreasConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: ccsExclusionAreasLayerName,
    title: ccsExclusionAreasTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: ccsExclusionAreasLayerName,
            queryable: true,
            popupFields: {
                'Notes': { field: 'notes', type: 'string' },
            }
        }
    ],
};

// Oil and Gas Fields
const oilGasFieldsLayerName = 'oilgasfields';
const oilGasFieldsTitle = 'Oil and Gas Fields';
const oilGasFieldsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: oilGasFieldsLayerName,
    title: oilGasFieldsTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: oilGasFieldsLayerName,
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

// Cores and Cuttings
const coresLayerName = 'cores';
const coresTitle = 'Cores and Cuttings';
const coresConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: coresLayerName,
    title: coresTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: coresLayerName,
            queryable: true,
            popupFields: {
                'API': { field: 'apishort', type: 'string' },
                'UWI': { field: 'uwi', type: 'string' },
                'Well Name': { field: 'well_name', type: 'string' },
                'Sample Types': {
                    field: 'all_types', type: 'string', transform: (value: string | null) => {
                        if (value) return toTitleCase(value.replace(/,/g, ', '));
                        return 'No Data';
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
                        if (top == null || bottom == null) return 'Depth N/A';
                        return `${addThousandsSeparator(top)} - ${addThousandsSeparator(bottom)} ft`;
                    }
                },
                'Formation at TD': { field: 'form_td', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Cored Formations': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        const formation = props?.['formation'] || '';
                        const coredFormation = props?.['cored_formation'] || '';
                        if (formation && coredFormation) return `${formation}, ${coredFormation}`;
                        if (formation) return formation;
                        if (coredFormation) return coredFormation;
                        return '';
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
                    transform: (value: string | null) => [{
                        label: `${value}`,
                        href: 'https://geology.utah.gov/apps/rockcore/'
                    }]
                }
            }
        }
    ],
};

// Wells Database
export const wellWithTopsLayerName = 'wellswithtops_hascore';
export const wellWithTopsTitle = 'Wells Database';
export const wellWithTopsWMSTitle = wellWithTopsTitle; // Alias for compatibility
const wellWithTopsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: wellWithTopsLayerName,
    title: wellWithTopsTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: wellWithTopsLayerName,
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

// Pipelines
const pipelinesLayerName = 'pipelines';
const pipelinesTitle = 'Pipelines';
const pipelinesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: pipelinesLayerName,
    title: pipelinesTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: pipelinesLayerName,
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

// Geothermal Power Plants
const geothermalPowerplantsLayerName = 'ccus_geothermalpowerplants';
const geothermalPowerplantsTitle = 'Geothermal Power Plants';
const geothermalPowerplantsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: geothermalPowerplantsLayerName,
    title: geothermalPowerplantsTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: geothermalPowerplantsLayerName,
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

// Rivers
const riversLayerName = 'rivers';
const riversTitle = 'Major Rivers';
const riversConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: riversLayerName,
    title: riversTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: riversLayerName,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Water Right Area': { field: 'drainage_a', type: 'number' }
            },
        },
    ],
};

// Major Roads
const roadsLayerName = 'ccus_majorroads';
const roadsTitle = 'Major Roads';
const roadsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: roadsLayerName,
    title: roadsTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: roadsLayerName,
            queryable: false,
            popupFields: {
                'Name': { field: 'fullname', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
            },
        },
    ],
};

// Railroads
const railroadsLayerName = 'ccus_railroads';
const railroadsTitle = 'Railroads';
const railroadsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: railroadsLayerName,
    title: railroadsTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: railroadsLayerName,
            queryable: true,
            popupFields: {
                'Name': { field: 'railroad', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
            },
        },
    ],
};

// Transmission Lines
const transmissionLinesLayerName = 'ccus_transmissionlines';
const transmissionLinesTitle = 'Transmission Lines';
const transmissionLinesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: transmissionLinesLayerName,
    title: transmissionLinesTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: transmissionLinesLayerName,
            queryable: false,
            popupFields: {
                'Voltage': { field: 'layer', type: 'string' },
            },
        },
    ],
};

// Wilderness Study Areas
const wildernessStudyAreasLayerName = 'ccus_wsa';
const wildernessStudyAreasTitle = 'Wilderness Study Areas';
const wildernessStudyAreasConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: wildernessStudyAreasLayerName,
    title: wildernessStudyAreasTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: wildernessStudyAreasLayerName,
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

// Quaternary Faults
const qFaultsLayerName = 'quaternaryfaults_current';
const qFaultsTitle = 'Hazardous (Quaternary age) Faults';
const qFaultsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: qFaultsLayerName,
    title: qFaultsTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: qFaultsLayerName,
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
                        if (!props) return 'No USGS link available';
                        return props['usgs_link'] || 'No USGS link available';
                    }
                },
            },
            linkFields: {
                'usgs_link': {
                    transform: (usgsLink: unknown) => {
                        if (!usgsLink || usgsLink === 'No USGS link available') {
                            return [{ label: 'No USGS link available', href: '' }];
                        }
                        return [{ label: 'Detailed Report', href: `${usgsLink}` }];
                    }
                }
            },
        },
    ],
};

// Utah Faults
const faultsLayerName = 'faults_m-179dm';
const faultsTitle = 'Utah Faults';
const faultsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: CARBONSTORAGE_PMTILES_URL,
    styleUrl: CARBONSTORAGE_STYLE_URL,
    sourceLayer: faultsLayerName,
    title: faultsTitle,
    visible: false,
    opacity: 1,
    sublayers: [
        {
            name: faultsLayerName,
            queryable: true,
            popupFields: {
                'Description': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        const subtype = props?.['subtype'];
                        const type = props?.['type'];
                        const modifier = props?.['modifier'];
                        return toSentenceCase(`${subtype} ${type}, ${modifier}`);
                    }
                },
                'Scale': {
                    field: 'scale',
                    type: 'string',
                    transform: (value: string | null) => {
                        if (value === 'small') return '1:500,000';
                        return '';
                    }
                },
                'Source': { field: 'series_id', type: 'string' },
            },
            linkFields: {
                'series_id': {
                    baseUrl: '',
                    transform: (value: string) => [{
                        href: `https://doi.org/10.34191/${value}`,
                        label: `${value}`
                    }]
                }
            }
        },
    ],
};

// Group configurations
const ccsResourcesConfig: LayerProps = {
    type: 'group',
    title: 'Carbon Storage Resources',
    visible: true,
    layers: [
        sco2Config,
        basinNamesConfig,
        co2SourcesConfig,
        sitlaReportsConfig,
        ccsExclusionAreasConfig
    ]
};

const subsurfaceDataConfig: LayerProps = {
    type: 'group',
    title: 'Subsurface Data',
    visible: false,
    layers: [
        wellWithTopsConfig,
        coresConfig,
        oilGasFieldsConfig
    ]
};

const geologicalInformationConfig: LayerProps = {
    type: 'group',
    title: 'Geological Information',
    visible: false,
    layers: [
        qFaultsConfig,
        faultsConfig,
    ]
};

const infrastructureAndLandUseConfig: LayerProps = {
    type: 'group',
    title: 'Infrastructure and Land Use',
    visible: false,
    layers: [
        geothermalPowerplantsConfig,
        pipelinesConfig,
        riversConfig,
        roadsConfig,
        railroadsConfig,
        transmissionLinesConfig,
        wildernessStudyAreasConfig,
    ]
};

const layersConfig: LayerProps[] = [
    ccsResourcesConfig,
    subsurfaceDataConfig,
    geologicalInformationConfig,
    infrastructureAndLandUseConfig,
];

export default layersConfig;
