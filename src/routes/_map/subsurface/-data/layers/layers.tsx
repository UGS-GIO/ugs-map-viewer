import { Link } from "@/components/ui/link";
import { ENERGY_MINERALS_WORKSPACE, MAPPING_WORKSPACE, parquetUrl, PROD_GEOSERVER_URL, PROD_POSTGREST_URL } from "@/lib/constants";
import { LayerProps, WMSLayerProps, PMTilesLayerProps } from "@/lib/types/mapping-types";
import { formatNumeric } from "@/lib/utils";
import { ucrcWellsConfig } from "@/lib/map/ucrc-wells-layer";


export const wellWithTopsLayerName = 'wellswithtops_hascore';
export const wellWithTopsWMSTitle = 'Oil and Gas Wells';
const wellWithTopsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: wellWithTopsWMSTitle,
    subtitle: 'Utah Division of Oil, Gas & Mining',
    visible: false,
    crs: 'EPSG:26912',
    sourceAgency: 'Utah Division of Oil, Gas & Mining',
    sourceUrl: 'https://gis.utah.gov/products/sgid/energy/oil-gas-wells/',
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
            visible: false,
            crs: 'EPSG:26912',
        }],
    },
};


// Utah counties
const utCountiesConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: 'Utah Counties',
    visible: false,
    crs: 'EPSG:3857',
    downloadParquetUrl: parquetUrl("enmin_ut_counties"),
    sourceAgency: 'UGRC',
    sublayers: [{
        name: `${ENERGY_MINERALS_WORKSPACE}:enmin_ut_counties_current`,
        popupEnabled: false,
        queryable: false,
    }],
};

// Utah township & ranges
export const utTownshipRangesLayerName = 'enmin_plss_townshiprange_current';
export const utTownshipRangesTitle = 'Utah Township & Ranges'; 
const utTownshipRangesConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: utTownshipRangesTitle,
    visible: false,
    crs: 'EPSG:3857',
    visibleZoomRange: [11, 22],
    sourceAgency: 'UGRC',
    sourceUrl: 'https://gis.utah.gov/products/sgid/cadastre/plss-sections/',
    sublayers: [{
        name: `${ENERGY_MINERALS_WORKSPACE}:${utTownshipRangesLayerName}`,
        popupEnabled: false,
        queryable: false,
    }],
};

// Sections — STAC-driven: pmtilesUrl, sourceLayer, and renders come from the
// warehouse item `enmin_plss_sections`. Sits just below Township & Range
// (same PLSS/UGRC source) in both the layer list and the map stack.
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
    sublayers: [{
        name: sectionsLayerName,
        popupEnabled: false,
        queryable: false,
    }],
};



// Oil and Gas Fields WMS Layer
const oilGasFieldsLayerName = 'enmin_oilgasfields_ogm_current';
const oilGasFieldsWMSTitle = 'Oil and Gas Fields';
const oilGasFieldsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: oilGasFieldsWMSTitle,
    visible: false,
    crs: 'EPSG:3857',
    sourceAgency: 'Utah Geological Survey and Utah Division of Oil, Gas and Mining',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${oilGasFieldsLayerName}`,
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

// UCRC Basins — STAC-driven: pmtilesUrl, sourceLayer, renders and
// downloadParquetUrl come from the warehouse item `enmin_ucrc_basins`.
const basinsLayerName = 'enmin_ucrc_basins';
const basinsTitle = 'Basins';
const basinsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: basinsLayerName,
    pmtilesUrl: '',
    sourceLayer: basinsLayerName,
    title: basinsTitle,
    visible: false,
    opacity: 1,
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: basinsLayerName,
            popupEnabled: false,
            // Selection off: the basins span many tiles, and a click highlights only the clipped
            // fragment from the tile that answered. Re-enable once the click path resolves full
            // geometry rather than the tile's piece.
            queryable: false,
            popupFields: {
                'Feature': { field: 'feature', type: 'string' },
                'Label': { field: 'label', type: 'string' },
            },
        },
    ],
};

// Non Petroleum Wells Layer — STAC-driven: pmtilesUrl, sourceLayer, and
// renders come from the warehouse item `enmin_non_petroleum_wells`.
const nonpetrolWellsLayerName = 'enmin_non_petroleum_wells';
const nonpetrolWellsTitle = 'Exploration Boreholes - Downhole Data';
const nonpetrolWellsConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: nonpetrolWellsLayerName,
  pmtilesUrl: '',
  sourceLayer: nonpetrolWellsLayerName,
  title: nonpetrolWellsTitle,
  visible: false,
  opacity: 1,
  sourceAgency: 'Utah Geological Survey',
  sublayers: [
    {
      name: nonpetrolWellsLayerName,
      popupEnabled: true,
      queryable: true,
      popupFields: {
        'Name': { field: 'well_name', type: 'string' },
        'UWI': { field: 'uwi', type: 'string' },
        'Operator': { field: 'operator', type: 'string' },
        'Depth': {
            field: 'custom',
            type: 'custom',
            transform: (props) => {
                const bht = props?.['depth'];
                return `${bht} ft`;
            }
        },
        'County': {
            field: 'custom',
            type: 'custom',
            transform: (props) => {
                const cnty = props?.['county'];
                const st = props?.['state'];
                return `${cnty} , ${st}`;
            }
        },
        'Location': {
            field: 'custom',
            type: 'custom',
            transform: (props) => {
              const tnum = props?.['town_num'];
              const tdir = props?.['town_dir'];
              const rnum = props?.['range_num'];
              const rdir = props?.['range_dir'];
              const sect = props?.['sect'];
              return `${tnum}${tdir} ${rnum}${rdir} Section ${sect}`;
            }
        },
        'Meridian': { field: 'meridian', type: 'string' },
        'Purpose': {
          field: 'purpose',
          type: 'string',
          transform: (value: string | null) => {
            if (value === 'C') return 'Coal';
            if (value === 'T') return 'Tar Sands';
            if (value === 'SH') return 'Oil Shale';
            if (value === 'W') return 'Water/Geothermal';
            return 'Unknown';
          }
        },
        'Reports': {
          field: 'analyses',
          type: 'string',
          transform: (value: string | null) => {
            if (value === 'Y') return 'Available';
            if (value === 'N') return 'None';
            return 'Unknown';
          }
        },
        'Well Logs': {
          field: 'well_logs',
          type: 'string',
          transform: (value: string | null) => {
            if (value === 'Y') return 'Available';
            if (value === 'N') return 'None';
            return 'Unknown';
          }
        },
      },
      relatedTables: [
                {
                    fieldLabel: 'Well Log Files',
                    matchingField: 'well_id',
                    targetField: 'uwi',
                    url: PROD_POSTGREST_URL + '/nwpd_welllogs',
                    headers: {
                        "Accept-Profile": 'emp',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        {
                            field: 'filename',
                            label: '',
                            transform: (value: string | null, row) => {
                                const path = row?.['full_path'];
                                if (!path) return value || 'No link available';
                                return <Link to={String('http://maps-assets.geology.utah.gov/' + path)}>{value || 'View File'}</Link>;
                            }
                        },
                    ],
                    sortDirection: 'asc',
                },
                {
                    fieldLabel: 'Well Analyses Files',
                    matchingField: 'well_id',
                    targetField: 'uwi',
                    url: PROD_POSTGREST_URL + '/nwpd_wellanalyses',
                    headers: {
                        "Accept-Profile": 'emp',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        {
                            field: 'filename',
                            label: '',
                            transform: (value: string | null, row) => {
                                const path = row?.['full_path'];
                                if (!path) return value || 'No link available';
                                return <Link to={String('http://maps-assets.geology.utah.gov/' + path)}>{value || 'View File'}</Link>;
                            }
                        },
                    ],
                }]
        },
  ]
};



// Metal mining districts layer
const metalMiningDistrictsLayerName = 'metalmineralapp_mining_districts';
export const metalMiningDistrictsTitle = 'Mining Districts';
const metalMiningDistrictsConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: metalMiningDistrictsTitle,
    visible: false,
    crs: 'EPSG:3857',
    sourceAgency: 'Utah Geological Survey',
    sourceUrl: 'https://doi.org/10.34191/OFR-695',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${metalMiningDistrictsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'District': { field: 'district', type: 'string' },
                'Commodity': { field: 'commodity', type: 'string' },
                'Productive': { field: 'productive', type: 'string' },
                'Short Tons': { field: 'short_tons', type: 'string' },
                'Total Dollar Value': {
                    field: 'total_dollar_value',
                    type: 'string',
                    transform: (value: string | null) => {
                        if (value === null) {
                            return 'No Data';
                        }
                        return `$ ${formatNumeric(value)}`;
                    }
                },
                '': {
                    field: 'synonym',
                    type: 'custom',
                    transform: (() => 'Data current through 2017')
                },
            },
            linkFields: {
                'synonym': {
                    transform: (value: string | null) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://doi.org/10.34191/OFR-695'
                            }
                        ];
                    }
                }
            }
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
    visible: false,
    crs: 'EPSG:3857',
    sourceAgency: 'Utah Geological Survey',
    sourceUrl: 'https://geology.utah.gov/publication-details/?pub=M-179dm',
    sublayers: [
        {
            name: `${MAPPING_WORKSPACE}:${seamlessGeolunitsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Unit Description': { field: 'unit_name', type: 'string' },
            },
        },
    ],
};

// UCRC Collection Layer config + its name/title constants live in a shared module
// (`@/lib/map/ucrc-wells-layer`) so the carbonstorage route can reuse them (ALL-4356).
// Re-exported here for the subsurface index/filter/legend modules that import them by title.
export { ucrcWellsQualifiedName, ucrcWellsWMSTitle } from "@/lib/map/ucrc-wells-layer";


const subsurfaceDataConfig: LayerProps = {
    type: 'group',
    title: 'Other Subsurface Data',
    visible: false,
    layers: [
        wellWithTopsWMSConfig,
        nonpetrolWellsConfig,
    ]
}

const geologicalInformationConfig: LayerProps = {
    type: 'group',
    title: 'Geological Information',
    visible: false,
    layers: [
        seamlessGeolunitsWMSConfig,
    ]
}

const infrastructureAndLandUseConfig: LayerProps = {
    type: 'group',
    title: 'Infrastructure and Land Use',
    visible: false,
    layers: [
        oilGasFieldsWMSConfig,
        basinsConfig,
        metalMiningDistrictsConfig,
        SITLAConfig,
        utCountiesConfig,
        utTownshipRangesConfig,
        sectionsConfig,
    ]
}


const layersConfig: LayerProps[] = [
    ucrcWellsConfig,
    subsurfaceDataConfig,
    geologicalInformationConfig,
    infrastructureAndLandUseConfig
];

export default layersConfig;
