import { Link } from "@/components/ui/link";
import { BoxPhotosCell } from "@/components/maps/popups/box-photos-button";
import { ENERGY_MINERALS_WORKSPACE, MAPPING_WORKSPACE, PROD_GEOSERVER_URL, PROD_POSTGREST_URL } from "@/lib/constants";
import { LayerProps, WMSLayerProps, WFSLayerProps } from "@/lib/types/mapping-types";
import { makePieWedgeSpriteRegistrar } from "@/lib/map/pie-wedge-sprites";
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
const utCountiesConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: 'Utah Counties',
    visible: true,
    crs: 'EPSG:3857',
    sublayers: [{
        name: `${ENERGY_MINERALS_WORKSPACE}:enmin_ut_counties_current`,
        popupEnabled: false,
        queryable: false,
    }],
};

// Utah township & ranges
const utTownshipRangesConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: 'Utah Township & Ranges',
    visible: true,
    crs: 'EPSG:3857',
    sublayers: [{
        name: `${ENERGY_MINERALS_WORKSPACE}:enmin_plss_townshiprange_current`,
        popupEnabled: false,
        queryable: false,
    }],
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

// UCRC Basins
const basinsLayerName = 'enmin_ucrc_basins_current';
const basinsWMSTitle = 'Basins';
const basinsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: basinsWMSTitle,
    visible: true,
    crs: 'EPSG:3857',
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${basinsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Feature': { field: 'feature', type: 'string' },
                'Label': { field: 'label', type: 'string' },
            },
        },
    ],
};

// Non Petroleum Wells Layer
const nonpetrolWellsLayerName = 'nwpd_nonpetroleumwellcatalogwells';
const nonpetrolWellsTitle = 'Non-Petroleum Wells';
const nonpetrolWellsConfig: WMSLayerProps = {
  type: 'wms',
  url: `${PROD_GEOSERVER_URL}/wms`,
  title: nonpetrolWellsTitle,
  visible: true,
  crs: 'EPSG:3857',
  sublayers: [
    {
      name: `${ENERGY_MINERALS_WORKSPACE}:${nonpetrolWellsLayerName}`,
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
        }
      }
    }
  ]
};



// Metal mining districts layer
const metalMiningDistrictsLayerName = 'metalmineralapp_mining_districts';
const metalMiningDistrictsTitle = 'Metalliferous Mining Districts';
const metalMiningDistrictsConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: metalMiningDistrictsTitle,
    visible: true,
    crs: 'EPSG:3857',
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
                        return `$ ${addThousandsSeparator(value)}`;
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


const ucrcWellsName = 'ucrc_wells_current';
const ucrcWellsTitle = 'Utah Core Research Center Inventory (WMS)';
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
                'UWI': { field: 'uwi', type: 'string' },
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
            },
            relatedTables: [
                {
                    fieldLabel: 'Core Boxes',
                    matchingField: 'uwi',
                    targetField: 'uwi',
                    url: `${PROD_POSTGREST_URL}/enmin_ucrc_boxes_django_test_current`,
                    headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' },
                    displayAs: 'table',
                    displayFields: [
                        { field: 'box_number', label: 'Box #' },
                        { field: 'box_type', label: 'Box Type' },
                        { field: 'box_top_ft', label: 'Top (ft)', format: 'number' },
                        { field: 'box_bottom_ft', label: 'Bottom (ft)', format: 'number' },
                        { field: 'cored_formation', label: 'Formation' },
                    ],
                    sortBy: 'box_number',
                    sortDirection: 'asc',
                },
            ],
        }
    ]
};


// UCRC Wells Layer — rendered client-side via WFS for instant filtering and richer symbology
const ucrcWellsLayerName = 'enmin_ucrc_wells_django_test_current';
export const ucrcWellsQualifiedName = `${ENERGY_MINERALS_WORKSPACE}:${ucrcWellsLayerName}`;
export const ucrcWellsWMSTitle = 'UCRC Wells (Test)';

// Purpose colors mirror the GeoServer SLD for this layer (default style). Keep in sync if SLD changes.
export const UCRC_PURPOSE_COLORS: Record<string, string> = {
    'Oil and Gas': '#2B83BA',
    'Mining': '#D7191C',
    'Tar Sands': '#4B3621',
    'Water': '#41B6C4',
    'Potash': '#E66101',
    'Coal': '#333333',
    'Stratigraphy': '#7B68EE',
    'Building or Construction': '#FDB863',
    'Oil Shale': '#8C6D31',
    'Geothermal': '#E31A1C',
    'Teaching': '#A6D854',
    'Display': '#FF69B4',
    'Other': '#BDBDBD',
};
export const UCRC_PURPOSE_STROKES: Record<string, string> = {
    'Oil and Gas': '#1A5276',
    'Mining': '#922B21',
    'Tar Sands': '#2C1F13',
    'Water': '#2C7F8C',
    'Potash': '#A04500',
    'Coal': '#1A1A1A',
    'Stratigraphy': '#5548A6',
    'Building or Construction': '#B08045',
    'Oil Shale': '#5E4921',
    'Geothermal': '#9E1213',
    'Teaching': '#74963B',
    'Display': '#B3497E',
    'Other': '#858585',
};

// Box-type pie-wedge symbology config (comma-delimited codes on each well).
export const UCRC_BOX_TYPE_CODES = ['BUTTS', 'CORE', 'CUTTINGS', 'SLABS'] as const;
export const UCRC_BOX_TYPE_COLORS: Record<string, string> = {
    BUTTS: '#E66101',
    CORE: '#5E3C99',
    CUTTINGS: '#1A9641',
    SLABS: '#0571B0',
};
const UCRC_BOX_TYPE_NAMESPACE = 'box-type';

const ucrcWellsWFSConfig: WFSLayerProps = {
    type: 'wfs',
    wfsUrl: `${PROD_GEOSERVER_URL}/wfs`,
    typeName: ucrcWellsQualifiedName,
    title: ucrcWellsWMSTitle,
    visible: false,
    opacity: 0.85,
    crs: 'EPSG:4326',
    geometryType: 'point',
    style: {
        circleRadiusByZoom: [
            [4, 2],
            [7, 4],
            [10, 6],
            [13, 8],
            [16, 10],
        ],
        circleStrokeWidth: 1,
        circleColorMatch: {
            field: 'purpose',
            matches: UCRC_PURPOSE_COLORS,
            defaultColor: UCRC_PURPOSE_COLORS.Other,
        },
        circleStrokeColorMatch: {
            field: 'purpose',
            matches: UCRC_PURPOSE_STROKES,
            defaultColor: UCRC_PURPOSE_STROKES.Other,
        },
        // Box-type pie-wedge symbology, gated by Symbolize By dropdown
        iconSymbologyKey: UCRC_BOX_TYPE_NAMESPACE,
        iconImageExpression: ['concat', `${UCRC_BOX_TYPE_NAMESPACE}-`, ['coalesce', ['get', 'box_type_codes'], '']],
        iconSizeByZoom: [
            [4, 0.1],
            [7, 0.2],
            [10, 0.3],
            [13, 0.4],
            [16, 0.5],
        ],
        registerSprites: makePieWedgeSpriteRegistrar({
            field: 'box_type_codes',
            codes: UCRC_BOX_TYPE_CODES,
            colors: UCRC_BOX_TYPE_COLORS,
            namespace: UCRC_BOX_TYPE_NAMESPACE,
        }),
        pieGlyphLegend: {
            codes: UCRC_BOX_TYPE_CODES,
            colors: UCRC_BOX_TYPE_COLORS,
        },
    },
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${ucrcWellsLayerName}`,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'API Number': { field: 'api_number', type: 'string' },
                'Well Name': { field: 'well_name', type: 'string' },
                'County': { field: 'county', type: 'string' },
                'Operator': { field: 'current_operator', type: 'string' },
                'Field': { field: 'field_name', type: 'string' },
                'Purpose': { field: 'purpose', type: 'string' },
                'Producing Formation': { field: 'producing_formation', type: 'string' },
                'TD (ft)': { field: 'td_ft', type: 'number' },
                'Elevation (GL ft)': { field: 'elevation_gl', type: 'number' },
            },
            relatedTables: [
                {
                    fieldLabel: 'Core Boxes',
                    matchingField: 'uwi',
                    targetField: 'uwi',
                    url: `${PROD_POSTGREST_URL}/enmin_ucrc_boxes_django_test_current`,
                    headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' },
                    displayAs: 'table',
                    displayFields: [
                        { field: 'box_number', label: 'Box #' },
                        { field: 'box_type', label: 'Type' },
                        { field: 'box_top_ft', label: 'Top (ft)', format: 'number' },
                        { field: 'box_bottom_ft', label: 'Bottom (ft)', format: 'number' },
                        { field: 'cored_formation', label: 'Formation' },
                        { field: 'notes_public', label: 'Notes', transform: (v) => v || '—' },
                        {
                            field: 'pk',
                            label: 'Photos',
                            transform: (pk, _row, allRows) => (
                                <BoxPhotosCell
                                    boxId={pk}
                                    allBoxIds={(allRows ?? []).map(r => String(r.pk))}
                                />
                            ),
                        },
                    ],
                    sortBy: 'box_number',
                    sortDirection: 'asc',
                },
                {
                    fieldLabel: 'Core Photos',
                    matchingField: 'uwi',
                    targetField: 'uwi',
                    url: `${PROD_POSTGREST_URL}/enmin_ucrc_photos_django_test_current`,
                    headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' },
                    displayAs: 'gallery',
                    galleryUrlField: 'gcs_path',
                    galleryBaseUrl: 'https://ucrc-assets.geology.utah.gov',
                    galleryThumbnailTransform: (gcsPath: string) =>
                        gcsPath.startsWith('photos/')
                            ? `photos/_thumbs/200/${gcsPath.slice('photos/'.length)}`
                            : `_thumbs/200/${gcsPath}`,
                    galleryLabelField: 'filename',
                    galleryMetadataFields: [
                        { field: 'photo_type', label: 'Type' },
                        { field: 'top_depth', label: 'Top (ft)' },
                        { field: 'bottom_depth', label: 'Bottom (ft)' },
                    ],
                    sortBy: 'top_depth',
                    sortDirection: 'asc',
                },
                {
                    fieldLabel: 'Attachments',
                    matchingField: 'uwi',
                    targetField: 'uwi',
                    url: `${PROD_POSTGREST_URL}/enmin_ucrc_attachments_django_test_current`,
                    headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' },
                    displayAs: 'list',
                    displayFields: [
                        { field: 'filename', label: 'File' },
                        { field: 'notes', label: 'Notes' },
                    ],
                },
            ],
        },
    ],
};


const subsurfaceDataConfig: LayerProps = {
    type: 'group',
    title: 'Subsurface Data',
    visible: false,
    layers: [
        oilGasFieldsWMSConfig,
        basinsWMSConfig,
        metalMiningDistrictsConfig,
        wellWithTopsWMSConfig,
        nonpetrolWellsConfig,
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

const infrastructureAndLandUseConfig: LayerProps = {
    type: 'group',
    title: 'Infrastructure and Land Use',
    visible: true,
    layers: [
        SITLAConfig,
        pipelinesWMSConfig,
        utCountiesConfig,
        utTownshipRangesConfig,
    ]
}


const layersConfig: LayerProps[] = [
    ucrcWellsConfig,
    ucrcWellsWFSConfig,
    subsurfaceDataConfig,
    geologicalInformationConfig,
    infrastructureAndLandUseConfig
];

export default layersConfig;