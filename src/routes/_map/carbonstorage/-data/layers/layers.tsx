import { isHttpUrl, Link, linkIfUrl } from "@/components/ui/link";
import { MAPS_ASSETS_CDN_URL, parquetUrl } from "@/lib/constants";
import { ArcGISMapServerLayerProps, LayerProps, PMTilesLayerProps } from "@/lib/types/mapping-types";
import { addThousandsSeparator, toTitleCase } from "@/lib/utils";
import { GeoJsonProperties } from "geojson";
import { ucrcWellsConfig } from "@/routes/_map/-shared/layers/ucrc-wells";
import { nonpetrolWellsConfig, nonpetrolWellsTitle } from "@/routes/_map/-shared/layers/non-petroleum-wells";

export { nonpetrolWellsTitle };

const CCUS_IMAGE_BASE_URL = `${MAPS_ASSETS_CDN_URL}/ccus/png`;

// Geo-Region Carbon Storage Ranking
const georegionsLayerName = 'enmin_ccs_georegions';
export const georegionsTitle = 'Geo-Region Carbon Storage Ranking';
export const georegionsWMSTitle = georegionsTitle;
const georegionsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: georegionsLayerName,
    pmtilesUrl: '',
    sourceLayer: georegionsLayerName,
    title: georegionsTitle,
    formerTitles: ['Geo-region Carbon Storage Ranking'],
    sectionHeading: 'Statewide',
    visible: true,
    opacity: 0.3,
    polygonLabels: true,
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: georegionsLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
                'Ranking': { field: 'ranking', type: 'string' },
                'Key Reservoirs': { field: 'keyreservoirs', type: 'string' },
                'Key Caprocks': { field: 'keycaprocks', type: 'string' },
                'Description': { field: 'description', type: 'string' },
            },
            imageFields: [
                { field: 'georegionmap', label: 'Geo-Region Map', baseUrl: `${CCUS_IMAGE_BASE_URL}/georegionmaps` },
                { field: 'stratcolumn', label: 'Stratigraphic Column', baseUrl: `${CCUS_IMAGE_BASE_URL}/stratcolumns` },
            ],
            colorCodingMap: {
                'ranking': (value: string | number) => {
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

// Oil and Gas Fields
const oilGasFieldsLayerName = 'enmin_oilgasfields_ogm';
export const oilGasFieldsTitle = 'Oil and Gas Fields';
export const oilGasFieldsWMSTitle = oilGasFieldsTitle;
const oilGasFieldsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: oilGasFieldsLayerName,
    pmtilesUrl: '',
    sourceLayer: oilGasFieldsLayerName,
    title: oilGasFieldsTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'Utah Division of Oil, Gas and Mining',
    sublayers: [
        {
            name: oilGasFieldsLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Field Name': { field: 'fieldname', type: 'string' },
                'Field Type': { field: 'type', type: 'string' },
                'Producing Formations': { field: 'prodformations', type: 'string' },
                'Reservoir Age': { field: 'reservoir_rocks', type: 'string' },
                'Status': { field: 'status_1', type: 'string' }
            },
        },
    ],
};

// Pipelines
const pipelinesLayerName = 'enmin_pipelines';
export const pipelinesTitle = 'Pipelines';
export const pipelinesWMSTitle = pipelinesTitle;
const pipelinesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: pipelinesLayerName,
    pmtilesUrl: '',
    sourceLayer: pipelinesLayerName,
    title: pipelinesTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'UGRC',
    sublayers: [
        {
            name: pipelinesLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Operator': { field: 'operator', type: 'string' },
                'Commodity': { field: 'commodity', type: 'string' },
                'Acronym': { field: 'acronym', type: 'string' },
                'Code Remarks': { field: 'code_rmrks', type: 'string' }
            },
        },
    ],
};

// Statewide Storage Resource Estimates
const sco2GridSummaryLayerName = 'enmin_ccs_sco2_gridsummaries';
export const sco2GridSummaryTitle = 'Statewide Storage Resource Estimates';
export const sco2GridSummaryWMSTitle = sco2GridSummaryTitle;
const sco2GridSummaryConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: sco2GridSummaryLayerName,
    pmtilesUrl: '',
    sourceLayer: sco2GridSummaryLayerName,
    title: sco2GridSummaryTitle,
    sectionHeading: 'Statewide',
    visible: false,
    opacity: 0.75,
    polygonLabels: true,
    bivariateLegend: { xLabel: 'Cost', yLabel: 'Capacity' },
    sublayers: [
        {
            name: sco2GridSummaryLayerName,
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
                    url: parquetUrl('enmin_ccs_sco2_points'),
                    fetchMode: 'parquet',
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

// Rivers
const riversLayerName = 'enmin_ccs_rivers';
export const riversTitle = 'Major Rivers';
export const riversWMSTitle = riversTitle;
const riversConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: riversLayerName,
    pmtilesUrl: '',
    sourceLayer: riversLayerName,
    title: riversTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'UGRC',
    sourceUrl: 'https://opendata.gis.utah.gov/datasets/utah-major-rivers-polygons/about',
    sublayers: [
        {
            name: riversLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Water Right Area': { field: 'drainage_a', type: 'number' }
            },
        },
    ],
};

// Major Roads
const roadsLayerName = 'enmin_ccs_majorroads';
export const roadsTitle = 'Major Roads';
export const roadsWMSTitle = roadsTitle;
const roadsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: roadsLayerName,
    pmtilesUrl: '',
    sourceLayer: roadsLayerName,
    title: roadsTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'Local data stewards, UDOT, and UGRC',
    sourceUrl: 'https://opendata.gis.utah.gov/datasets/utah-roads/about',
    sublayers: [
        {
            name: roadsLayerName,
            popupEnabled: false,
            queryable: false,
            popupFields: {
                'Name': { field: 'fullname', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
            },
        },
    ],
};

// Railroads
const railroadsLayerName = 'enmin_ccs_railroads';
export const railroadsTitle = 'Railroads';
export const railroadsWMSTitle = railroadsTitle;
const railroadsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: railroadsLayerName,
    pmtilesUrl: '',
    sourceLayer: railroadsLayerName,
    title: railroadsTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'UGRC',
    sourceUrl: 'https://opendata.gis.utah.gov/datasets/utah-railroads/about',
    sublayers: [
        {
            name: railroadsLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'railroad', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
            },
        },
    ],
};

// Transmission Lines
const transmissionLinesLayerName = 'enmin_transmissionlines';
export const transmissionLinesTitle = 'Transmission Lines';
export const transmissionLinesWMSTitle = transmissionLinesTitle;
const transmissionLinesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: transmissionLinesLayerName,
    pmtilesUrl: '',
    sourceLayer: transmissionLinesLayerName,
    title: transmissionLinesTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'HIFLD / U.S. Government',
    sourceUrl: 'https://www.arcgis.com/home/item.html?id=d4090758322c4d32a4cd002ffaa0aa12',
    sublayers: [
        {
            name: transmissionLinesLayerName,
            popupEnabled: false,
            queryable: false,
            popupFields: {
                'Voltage': { field: 'voltage', type: 'string' },
            },
        },
    ],
};

// Seamless Geological Units (500k)
const seamlessGeolunitsLayerName = 'geolmap_geolunits_500k';
export const seamlessGeolunitsTitle = 'Geologic Units (500k)';
export const seamlessGeolunitsWMSTitle = seamlessGeolunitsTitle;
const seamlessGeolunitsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: seamlessGeolunitsLayerName,
    pmtilesUrl: '',
    sourceLayer: seamlessGeolunitsLayerName,
    title: seamlessGeolunitsTitle,
    opacity: 0.5,
    visible: false,
    sourceAgency: 'Utah Geological Survey',
    sourceUrl: 'https://geology.utah.gov/publication-details/?pub=M-179dm',
    customLegend: <div className="px-1 py-1 text-xs text-muted-foreground italic">No Legend Provided</div>,
    sublayers: [
        {
            name: seamlessGeolunitsLayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Unit': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        const unitName = props?.['unitname'] ?? props?.['unit_name'];
                        const unitSymbol = props?.['unitsymbol'] ?? props?.['unit_symbol'];
                        return `${unitName} (${unitSymbol})`;
                    }
                },
                'Unit Description': { field: 'notes', type: 'string' },
                'Source': { field: 'metadata_publication_id', type: 'string' },
            },
            linkFields: {
                'metadata_publication_id': {
                    baseUrl: '',
                    transform: (value: string) => {
                        return [{
                            href: `https://doi.org/10.34191/${value}`,
                            label: `${value}`
                        }];
                    }
                }
            }
        },
    ],
};

// Wells Database
export const wellWithTopsLayerName = 'enmin_ccs_wells_formation';
export const wellWithTopsTitle = 'Wells Database';
export const wellWithTopsWMSTitle = wellWithTopsTitle;
const wellWithTopsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: wellWithTopsLayerName,
    pmtilesUrl: '',
    sourceLayer: wellWithTopsLayerName,
    title: wellWithTopsTitle,
    visible: true,
    opacity: 0.8,
    sourceAgency: 'Utah Division of Oil, Gas and Mining',
    sublayers: [
        {
            name: wellWithTopsLayerName,
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
                    stacAsset: 'enmin_ccs_wells_formationdepths',
                    matchingField: 'api',
                    targetField: 'api',
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
                    stacAsset: 'enmin_ccs_las',
                    matchingField: 'wells_formation_api',
                    targetField: 'api',
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

// SITLA Land Ownership Layer (ArcGIS MapServer)
const SITLAConfig: ArcGISMapServerLayerProps = {
    type: 'map-image',
    url: 'https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership_WM/MapServer',
    title: 'Land Ownership',
    opacity: 0.5,
    visible: false,
    sourceAgency: 'Utah School and Institutional Trust Lands Administration (SITLA)',
};

// Utah Faults (M-179DM publication Geology_arc filtered to TYPE='fault')
const faultsSourceLayer = 'Geology_arc';
const M179DM_GEOLOGY_ARC_STAC_URL =
    `${MAPS_ASSETS_CDN_URL}/warehouse/stac/ugs-publications/M/M-179DM/M-179DM__Geology_arc/M-179DM__Geology_arc.json`;
export const faultsTitle = 'Utah Faults';
export const faultsWMSTitle = faultsTitle;
const faultsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemUrl: M179DM_GEOLOGY_ARC_STAC_URL,
    defaultRenderId: 'faults',
    pmtilesUrl: '',
    sourceLayer: faultsSourceLayer,
    title: faultsTitle,
    featureFilter: ['==', ['downcase', ['to-string', ['get', 'TYPE']]], 'fault'],
    visible: false,
    opacity: 0.8,
    sourceAgency: 'Utah Geological Survey',
    sourceUrl: 'https://geology.utah.gov/publication-details/?pub=M-179dm',
    // Publication STAC items are not yet rebound by `ugs-warehouse.restyle`; point directly at the published CDN render.
    renders: [{
        id: 'faults',
        styleUrl: `${MAPS_ASSETS_CDN_URL}/styles/styles/M-179DM__Geology_arc/faults.json`,
        sprite: `${MAPS_ASSETS_CDN_URL}/styles/styles/M-179DM__Geology_arc/sprite`,
        legend: [
            { label: 'Fault, Normal, Well Located', color: '#000000', shape: 'line' },
            { label: 'Fault, Normal, Approximately Located', color: '#000000', shape: 'line' },
            { label: 'Fault, Normal, Concealed', color: '#000000', shape: 'line' },
            { label: 'Fault, Thrust, Well Located', color: '#000000', shape: 'line' },
            { label: 'Fault, Thrust, Approximately Located', color: '#000000', shape: 'line' },
            { label: 'Fault, Thrust, Concealed', color: '#000000', shape: 'line' },
        ],
    }],
    sublayers: [
        {
            name: faultsSourceLayer,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Description': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        const subtype = props?.['SUBTYPE'];
                        const type = props?.['TYPE'];
                        const modifier = props?.['MODIFIER'];
                        const kind = [subtype, type].filter(Boolean).join(' ');
                        return [kind, modifier].filter(Boolean).join(', ');
                    },
                },
                'Scale': {
                    field: 'custom',
                    type: 'custom',
                    transform: () => '1:500,000',
                },
                'Source': {
                    field: 'fault_source_link',
                    type: 'custom',
                    transform: () => 'M-179DM',
                },
            },
            linkFields: {
                'fault_source_link': {
                    transform: (value: string | null) => [{
                        href: 'https://doi.org/10.34191/M-179DM',
                        label: value || 'M-179DM',
                    }],
                },
            },
        },
    ],
};

// Utah Faults (Quaternary Faults)
const qFaultsLayerName = 'hazards_qfaults';
export const qFaultsTitle = 'Hazardous Faults - Utah Quaternary Fault Database';
export const qFaultsWMSTitle = qFaultsTitle;
const qFaultsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: qFaultsLayerName,
    pmtilesUrl: '',
    sourceLayer: qFaultsLayerName,
    title: qFaultsTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: qFaultsLayerName,
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
                        if (!str || !isHttpUrl(str)) {
                            return [{ label: 'Detailed report not currently available', href: '' }];
                        }
                        return [{ label: str, href: str }];
                    }
                },
                'usgs_link': {
                    transform: (value: unknown) => {
                        const str = String(value ?? '');
                        if (!str || !isHttpUrl(str)) {
                            return [{ label: str || 'No USGS link available', href: '' }];
                        }
                        return [{ label: 'USGS Reference', href: str }];
                    }
                },
            },
        },
    ],
};

// CO2 Sources
const co2SourcesLayerName = 'enmin_ccs_co2_sources';
export const co2SourcesTitle = 'CO₂ Sources';
export const co2SourcesWFSTitle = co2SourcesTitle;
const co2SourcesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: co2SourcesLayerName,
    pmtilesUrl: '',
    sourceLayer: co2SourcesLayerName,
    title: co2SourcesTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'EPA FLIGHT Data, 2023',
    sublayers: [
        {
            name: co2SourcesLayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Facility Name': { field: 'facility_name', type: 'string', transform: (value: string | null) => toTitleCase(value || '') },
                'Description': { field: 'description', type: 'string' },
                'Greenhouse Gas Emissions': {
                    field: 'ghg_quantity_metric_tons_co2e',
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

// Wilderness Study Areas
const wildernessStudyAreasLayerName = 'enmin_ccs_wsa';
export const wildernessStudyAreasTitle = 'Wilderness Study Areas';
export const wildernessStudyAreasWMSTitle = wildernessStudyAreasTitle;
const wildernessStudyAreasConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: wildernessStudyAreasLayerName,
    pmtilesUrl: '',
    sourceLayer: wildernessStudyAreasLayerName,
    title: wildernessStudyAreasTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'U.S. Bureau of Land Management',
    sourceUrl: 'https://gbp-blm-egis.hub.arcgis.com/maps/0ae90ebbc1f54f77b80b76a6148ab83d/about',
    sublayers: [
        {
            name: wildernessStudyAreasLayerName,
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

// CO2 Storage Potential on SITLA Blocks
const sitlaReportsLayerName = 'enmin_ccs_sitlareports';
export const sitlaReportsTitle = 'CO₂ Storage Potential on SITLA Blocks';
export const sitlaReportsWMSTitle = sitlaReportsTitle;
const sitlaReportsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: sitlaReportsLayerName,
    pmtilesUrl: '',
    sourceLayer: sitlaReportsLayerName,
    title: sitlaReportsTitle,
    sectionHeading: 'Statewide',
    visible: false,
    opacity: 0.8,
    sourceAgency: 'Utah Geological Survey',
    sourceUrl: 'https://ugspub.nr.utah.gov/publications/non_lib_pubs/contract_deliverables/EMP-1.pdf',
    sublayers: [
        {
            name: sitlaReportsLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'new_block', type: 'string' },
                'Ranking': {
                    field: 'ranking', type: 'string',
                    transform: (value: string | null) => {
                        if (value === 'None' || value === null) {
                            return 'Not Evaluated';
                        }
                        return value.replace(/^\d+(\.\d+)?\s*/, '');
                    }
                },
                'Description': { field: 'description', type: 'string' },
                'Report': { field: 'linktoreport', type: 'string' },
            },
            linkFields: {
                'linktoreport': {
                    transform: (value: unknown) => {
                        const str = String(value ?? '');
                        if (!str || !str.startsWith('http')) return [];
                        return [{ label: 'View Report', href: str }];
                    },
                },
            },
            colorCodingMap: {
                'ranking': (value: string | number) => {
                    const strValue = String(value).toLowerCase();
                    if (strValue.includes("excellent")) return "#3DC200";
                    if (strValue.includes("good")) return "#CFFF00";
                    if (strValue.includes("some")) return "#FFE700";
                    if (strValue.includes("limited")) return "#FF7E00";
                    return "#CDCDCD";
                }
            },
            colorCodingMode: 'background',
        }
    ],
};

// CCS Exclusion Areas
const ccsExclusionAreasLayerName = 'enmin_ccs_exclusionzones';
export const ccsExclusionAreasTitle = 'CCS Exclusion Areas';
export const ccsExclusionAreasWMSTitle = ccsExclusionAreasTitle;
const ccsExclusionAreasConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: ccsExclusionAreasLayerName,
    pmtilesUrl: '',
    sourceLayer: ccsExclusionAreasLayerName,
    title: ccsExclusionAreasTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: ccsExclusionAreasLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Notes': { field: 'notes', type: 'string' },
                'Type': {
                    field: 'grade',
                    type: 'string',
                    transform: (value: string | null) => {
                        const normalized = value?.toLowerCase();
                        if (normalized === 'no-ccus-zone') return 'Exclusion Zones - Land Management';
                        if (normalized === 'no-ccus-zone-geo') return 'Exclusion Zones - Geology';
                        return value;
                    }
                },
            },
        },
    ],
};

// Past and Ongoing Projects
const pastProjectsLayerName = 'enmin_ccs_pastprojects';
export const pastProjectsRegionalTitle = 'Past and Ongoing Projects - Regional';
export const pastProjectsSiteSpecificTitle = 'Past and Ongoing Projects - Site-Specific';

const pastProjectsConfig = ({ title, sectionHeading, projectScale, defaultRenderId, visible }: {
    title: string;
    sectionHeading: string;
    projectScale: string;
    defaultRenderId: string;
    visible: boolean;
}): PMTilesLayerProps => ({
    type: 'pmtiles',
    stacItemId: pastProjectsLayerName,
    defaultRenderId,
    pmtilesUrl: '',
    sourceLayer: pastProjectsLayerName,
    title,
    sectionHeading,
    featureFilter: ['==', ['get', 'projectscale'], projectScale],
    visible,
    opacity: 1,
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: pastProjectsLayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Project Name': { field: 'namealias', type: 'string' },
                'Project Summary': { field: 'projectsummary', type: 'string' },
                'Timeline': { field: 'timeline', type: 'string' },
                'Reservoir Investigated': { field: 'reservoirinvestigated', type: 'string' },
                '': { field: 'link', type: 'string', transform: (value: string | null) => value },
            },
            linkFields: {
                'link': {
                    transform: (value: string) => {
                        const trimmed = value?.trim();
                        if (!trimmed || trimmed.toLowerCase() === 'coming soon' || !trimmed.startsWith('http')) {
                            return [{ label: trimmed || 'Not available', href: '' }];
                        }
                        return [{ label: 'More Information', href: trimmed }];
                    }
                }
            }
        }
    ],
});

export const pastProjectsRegionalConfig = pastProjectsConfig({
    title: pastProjectsRegionalTitle,
    sectionHeading: 'Regional',
    projectScale: 'Regional',
    defaultRenderId: 'regional',
    visible: true,
});

export const pastProjectsSiteSpecificConfig = pastProjectsConfig({
    title: pastProjectsSiteSpecificTitle,
    sectionHeading: 'Site-Specific',
    projectScale: 'Site Specific',
    defaultRenderId: 'site-specific',
    visible: true,
});

// Power Plants
const powerplantsLayerName = 'enmin_powerplants';
export const powerplantsTitle = 'Power Plants';
const powerplantsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: powerplantsLayerName,
    pmtilesUrl: '',
    sourceLayer: powerplantsLayerName,
    title: powerplantsTitle,
    visible: false,
    opacity: 1,
    sourceAgency: 'Utah Geological Survey',
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

// Rock Property Data: Wells & Fields
const rockPropertySourceField = { field: 'source_detailed', label: 'Source', transform: linkIfUrl() };

const geochemWellsLayerName = 'enmin_ccus_geochemistry';
export const geochemWellsTitle = 'Rock Property Data: Wells';
const geochemWellsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: geochemWellsLayerName,
    pmtilesUrl: '',
    sourceLayer: geochemWellsLayerName,
    title: geochemWellsTitle,
    formerTitles: ['Wells with Rock Property Data'],
    visible: false,
    opacity: 1,
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: geochemWellsLayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Well Name': { field: 'wellname', type: 'string' },
                'UWI': { field: 'uwi', type: 'string' },
                'Operator': { field: 'operator', type: 'string' },
                'Data Type': { field: 'datatype', type: 'string' },
                'Geo-Region': { field: 'georegion', type: 'string' },
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
                    fieldLabel: 'Rock Property Data',
                    stacAsset: 'enmin_ccus_geochemistry_measurements',
                    displayFields: [
                        { field: 'formation', label: 'Formation' },
                        { field: 'depth_top_interval', label: 'Depth (ft)' },
                        { field: 'porosity_percent', label: 'Porosity (%)' },
                        { field: 'perm_md_klink', label: 'Permeability (mD)' },
                        { field: 'salinity_ppm', label: 'Salinity (ppm)' },
                        rockPropertySourceField,
                        { field: 'doi', label: 'DOI', transform: linkIfUrl() },
                    ],
                    sortBy: 'depth_top_interval',
                    sortDirection: 'asc',
                    displayAs: 'table'
                },
            ],
        },
    ],
};

const geochemFieldsLayerName = 'enmin_ccus_geochemfieldpolys';
export const geochemFieldsTitle = 'Rock Property Data: Fields';
const geochemFieldsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: geochemFieldsLayerName,
    pmtilesUrl: '',
    sourceLayer: geochemFieldsLayerName,
    title: geochemFieldsTitle,
    visible: false,
    opacity: 0.5,
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: geochemFieldsLayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Field Name': { field: 'field', type: 'string' },
                'Type': { field: 'type', type: 'string' },
                'Status': { field: 'status', type: 'string' },
                'Discovery Year': { field: 'date', type: 'string' },
                'Producing Formations': { field: 'prodformations', type: 'string' },
                'Reservoir Rocks': { field: 'reservoir_rocks', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: 'Rock Property Data',
                    stacAsset: 'enmin_geochemistry_fields',
                    displayFields: [
                        { field: 'formation', label: 'Formation' },
                        { field: 'depth_top_interval', label: 'Depth (ft)' },
                        { field: 'porosity_percent', label: 'Porosity (%)' },
                        { field: 'perm_md_klink', label: 'Permeability (mD)' },
                        { field: 'salinity_ppm', label: 'Salinity (ppm)' },
                        rockPropertySourceField,
                    ],
                    sortBy: 'depth_top_interval',
                    sortDirection: 'asc',
                    displayAs: 'table'
                },
            ],
        },
    ],
};

// Geothermal Groundwater Wells
const geothermalWellsJoinsName = 'enmin_geothermal_ingenious_wellfeatures';
export const geothermalWellsJoinsTitle = 'Groundwater Wells';
export const geothermalWellsJoinsWMSTitle = geothermalWellsJoinsTitle;
const geothermalWellsJoinsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: geothermalWellsJoinsName,
    pmtilesUrl: '',
    sourceLayer: geothermalWellsJoinsName,
    title: geothermalWellsJoinsTitle,
    formerTitles: ['Geothermal Wells'],
    visible: false,
    opacity: 0.8,
    sourceAgency: 'INGENIOUS Project, 2022',
    sublayers: [
        {
            name: geothermalWellsJoinsName,
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

// Geothermal Springs
const geothermalSpringsJoinsName = 'enmin_geothermal_ingenious_springfeatures';
export const geothermalSpringsJoinsTitle = 'Springs';
export const geothermalSpringsJoinsWMSTitle = geothermalSpringsJoinsTitle;
const geothermalSpringsJoinsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: geothermalSpringsJoinsName,
    pmtilesUrl: '',
    sourceLayer: geothermalSpringsJoinsName,
    title: geothermalSpringsJoinsTitle,
    formerTitles: ['Geothermal Springs'],
    visible: false,
    opacity: 0.8,
    sourceAgency: 'INGENIOUS Project, 2022',
    sublayers: [
        {
            name: geothermalSpringsJoinsName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Feature URI': { field: 'featureuri', type: 'string' },
                'Spring Name': { field: 'springname', type: 'string' },
                'Thermal Class': { field: 'thermalclass', type: 'string' },
                'Max Measured Temperature (°C)': { field: 'maxmeasuredtemp_c', type: 'number' },
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

// Geothermal Wells & Springs
const geothermalWellsLayerName = 'enmin_geothermal_wellsandsprings';
export const geothermalWellsTitle = 'Geothermal Wells & Springs';
export const geothermalWellsWMSTitle = geothermalWellsTitle;
const geothermalWellsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: geothermalWellsLayerName,
    pmtilesUrl: '',
    sourceLayer: geothermalWellsLayerName,
    title: geothermalWellsTitle,
    visible: false,
    opacity: 0.8,
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: geothermalWellsLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Type': {
                    field: 'type',
                    type: 'string',
                    transform: (value) => {
                        if (value === 'W' || value === 'W?') return 'Well';
                        if (value === 'S' || value === 'S?') return 'Spring';
                        if (value === 'M') return 'Mine';
                        return value;
                    }
                },
                'Map Number': { field: 'mapno', type: 'string' },
                'Region': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => {
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

// Utah Counties
const utCountiesLayerName = 'enmin_ut_counties';
export const utCountiesTitle = 'Utah Counties';
export const utCountiesWMSTitle = utCountiesTitle;
const utCountiesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: utCountiesLayerName,
    pmtilesUrl: '',
    sourceLayer: utCountiesLayerName,
    title: utCountiesTitle,
    visible: false,
    opacity: 0.8,
    polygonLabels: true,
    sourceAgency: 'UGRC',
    sourceUrl: 'https://opendata.gis.utah.gov/datasets/utah-county-boundaries/about',
    sublayers: [{
        name: utCountiesLayerName,
        popupEnabled: false,
        queryable: false,
    }],
};

// Utah Township and Ranges
const utTownshipRangesLayerName = 'enmin_plss_townshiprange';
export const utTownshipRangesTitle = 'Utah Township & Ranges';
export const utTownshipRangesWMSTitle = utTownshipRangesTitle;
const utTownshipRangesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: utTownshipRangesLayerName,
    pmtilesUrl: '',
    sourceLayer: utTownshipRangesLayerName,
    title: utTownshipRangesTitle,
    visible: false,
    opacity: 0.8,
    visibleZoomRange: [11, 22],
    polygonLabels: true,
    sourceAgency: 'UGRC',
    sourceUrl: 'https://opendata.gis.utah.gov/datasets/utah-township-and-ranges/about',
    sublayers: [{
        name: utTownshipRangesLayerName,
        popupEnabled: false,
        queryable: false,
    }],
};

// Sections
const sectionsLayerName = 'enmin_plss_sections';
export const sectionsTitle = 'Sections';
const sectionsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: sectionsLayerName,
    pmtilesUrl: '',
    sourceLayer: sectionsLayerName,
    title: sectionsTitle,
    visible: false,
    opacity: 1,
    visibleZoomRange: [11, 22],
    sourceAgency: 'UGRC',
    sourceUrl: 'https://gis.utah.gov/products/sgid/cadastre/plss-sections/',
    polygonLabels: true,
    sublayers: [{
        name: sectionsLayerName,
        popupEnabled: false,
        queryable: false,
    }],
};

// Non-Petroleum Wells (shared STAC config lives in -shared/layers/non-petroleum-wells.tsx)

// NatCarb Locations Layer
const natCarbLocationsLayerName = 'enmin_ccs_natcarb_location';
export const natCarbLocationsTitle = 'NATCARB Atlas (2015)';

export const natCarbLocationsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: natCarbLocationsLayerName,
    pmtilesUrl: '',
    sourceLayer: natCarbLocationsLayerName,
    title: natCarbLocationsTitle,
    sectionHeading: 'Statewide',
    visible: false,
    opacity: 0.3,
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: natCarbLocationsLayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {},
            relatedTables: [
                {
                    fieldLabel: 'Project Data',
                    stacAsset: 'enmin_ccs_natcarb_measurement',
                    displayAs: 'table',
                    displayFields: [
                        { field: 'resource_n', label: 'Resource Name' },
                        { field: 'vol_low', label: 'Vol Low (Mt)', format: 'number' },
                        { field: 'vol_med', label: 'Vol Med (Mt)', format: 'number' },
                        { field: 'vol_high', label: 'Vol High (Mt)', format: 'number' },
                        { field: 'depth_ft', label: 'Depth (ft)', format: 'number' },
                        { field: 'thickness_', label: 'Thickness (ft)', format: 'number' },
                        { field: 'temperatur', label: 'Temp (°F)', format: 'number' },
                        { field: 'pressure_p', label: 'Pressure (psi)', format: 'number' },
                        { field: 'porosity_p', label: 'Porosity (%)', format: 'number' },
                        { field: 'permeabili', label: 'Permeability (mD)', format: 'number' },
                    ],
                    sortBy: 'depth_ft',
                    sortDirection: 'asc',
                },
            ],
        },
    ],
};

// Groups
const ccsResourcesConfig: LayerProps = {
    type: 'group',
    title: 'Carbon Storage Resources',
    visible: true,
    layers: [
        sco2GridSummaryConfig,
        georegionsConfig,
        natCarbLocationsConfig,
        sitlaReportsConfig,
        pastProjectsRegionalConfig,
        pastProjectsSiteSpecificConfig,
    ]
};

const infrastructureAndLandUseConfig: LayerProps = {
    type: 'group',
    title: 'Infrastructure and Land Use',
    visible: false,
    layers: [
        co2SourcesConfig,
        ccsExclusionAreasConfig,
        powerplantsConfig,
        pipelinesConfig,
        riversConfig,
        roadsConfig,
        railroadsConfig,
        transmissionLinesConfig,
        wildernessStudyAreasConfig,
        SITLAConfig,
        utCountiesConfig,
        utTownshipRangesConfig,
        sectionsConfig,
    ]
};

const geologicalInformationConfig: LayerProps = {
    type: 'group',
    title: 'Geological Information',
    visible: false,
    layers: [
        qFaultsConfig,
        faultsConfig,
        seamlessGeolunitsConfig,
    ]
};

const subsurfaceDataConfig: LayerProps = {
    type: 'group',
    title: 'Subsurface Data',
    visible: false,
    layers: [
        wellWithTopsConfig,
        geochemWellsConfig,
        {
            ...ucrcWellsConfig,
            visible: false,
            popupFooterLink: {
                label: 'Open this well in the UCRC Subsurface app',
                getHref: (properties) => {
                    const base = 'https://maps.geology.utah.gov/subsurface';
                    const lat = properties?.['latitude'];
                    const lon = properties?.['longitude'];
                    if (lat == null || lon == null) return base;
                    const layers = encodeURIComponent(JSON.stringify({ selected: ['Utah Core Research Center Inventory'] }));
                    return `${base}?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&zoom=15&layers=${layers}`;
                },
            },
        },
        oilGasFieldsConfig,
        geothermalWellsConfig,
        geothermalSpringsJoinsConfig,
        geothermalWellsJoinsConfig,
        nonpetrolWellsConfig,
        geochemFieldsConfig,
    ]
};

const layersConfig: LayerProps[] = [
    ccsResourcesConfig,
    subsurfaceDataConfig,
    geologicalInformationConfig,
    infrastructureAndLandUseConfig
];

export default layersConfig;
