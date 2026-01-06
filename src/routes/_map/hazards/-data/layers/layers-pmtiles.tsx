import { PROD_GEOSERVER_URL, HAZARDS_WORKSPACE, PROD_POSTGREST_URL, GEN_GIS_WORKSPACE } from "@/lib/constants";
import { LayerProps, WMSLayerProps, PMTilesLayerProps } from "@/lib/types/mapping-types";
import { GeoJsonProperties } from "geojson";
import GeoJSON from "geojson";

// Shared PMTiles URLs for all hazards layers
const HAZARDS_PMTILES_URL = 'https://storage.googleapis.com/ut-dnr-ugs-bucket-server-prod/pmtiles/hazards.pmtiles';
const HAZARDS_STYLE_URL = 'https://storage.googleapis.com/ut-dnr-ugs-bucket-server-prod/pmtiles/hazards.json';

export const landslideLegacyLayerName = 'landslidelegacy_current';
const landslideLegacyTitle = 'Legacy Landslide Compilation - Statewide';
const landslideLegacyConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: landslideLegacyLayerName,
    title: landslideLegacyTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: landslideLegacyLayerName,
            queryable: true,
            popupFields: {
                'State Landslide ID': { field: 'statelsid', type: 'string' },
                'Landslide Unit': { field: 'lsunit', type: 'string' },
                'Movement Type': { field: 'movetype', type: 'string' },
                'Historical': { field: 'historical', type: 'string' },
                'Geologic Unit': { field: 'geolunit', type: 'string' },
                'Map Scale': { field: 'mapscale', type: 'string' },
                'Map Name': { field: 'mapname', type: 'string' },
                'Pub Date': { field: 'pubdate', type: 'string' },
                'Author(s)': { field: 'author_s', type: 'string' },
                'Affiliated Unit': { field: 'affunit', type: 'string' },
                'Movement Unit': { field: 'moveunit', type: 'string' },
                'Movement Cause': { field: 'movecause', type: 'string' },
                'Notes': { field: 'notes', type: 'string' },
            },
        },
    ],
}

const landslideInventoryLayerName = 'landslideinventory_current';
const landslideInventoryTitle = 'Landslides';
const landslideInventoryConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: landslideInventoryLayerName,
    title: landslideInventoryTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: landslideInventoryLayerName,
            queryable: true,
            popupFields: {
                'Name': { field: 's_name', type: 'string' },
                'Activity': { field: 'activity', type: 'string' },
                'Confidence': { field: 'confidence', type: 'string' },
                'Comments': { field: 'comments', type: 'string' },
                'Deposit Movement 1': { field: 'd_h_move1', type: 'string' },
                'Deposit Movement 2': { field: 'd_h_move2', type: 'string' },
                'Deposit Movement 3': { field: 'd_h_move3', type: 'string' },
                'Primary Geologic Unit Involved': { field: 'd_geologic_unit1', type: 'string' },
                'Secondary Geologic Unit Involved': { field: 'd_geologic_unit2', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'lsfhazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const landslideSusceptibilityLayerName = 'landslidesusceptibility_current';
const landslideSusceptibilityTitle = 'Landslide Susceptibility';
const landslideSusceptibilityConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: landslideSusceptibilityLayerName,
    title: landslideSusceptibilityTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: landslideSusceptibilityLayerName,
            queryable: true,
            popupFields: {
                'Hazard': { field: 'hazard_symbology_text', type: 'string' },
                'Mapped Scale': { field: 'lssmappedscale', type: 'string' },
                'Critical Angle': { field: 'lsscriticalangle', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'lsshazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const liquefactionLayerName = 'liquefaction_current';
const liquefactionTitle = 'Liquefaction Susceptibility';
const liquefactionConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: liquefactionLayerName,
    title: liquefactionTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: liquefactionLayerName,
            queryable: true,
            popupFields: {
                'Hazard': { field: 'hazard_symbology_text', type: 'string' },
                'Mapped Scale': { field: 'lqsmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'lqshazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
};

// TODO: explore refactor to display peak ground acceleration like the imagery layer
const groundshakingLayerName = 'groundshaking_current';
const groundshakingWMSTitle = 'Earthquake Ground Shaking - Statewide';
const groundshakingWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: groundshakingWMSTitle,
    visible: false,
    opacity: 0.5,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${groundshakingLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                // empty in favor or using the rasterSource
            },
            rasterSource: {
                url: `${PROD_GEOSERVER_URL}/wms`,
                headers: {
                    "Accept": "application/json",
                    "Cache-Control": "no-cache",
                },
                layerName: `${HAZARDS_WORKSPACE}:earthquake_groundshaking`,
                valueField: "GRAY_INDEX",
                valueLabel: "Peak Ground Acceleration",
                transform: (value: number) => `${value} g`,
            }

        },
    ],
}
export interface QFaultsFeatureType {
    geom: GeoJSON.MultiLineString;
    concatnames: string;
    faultzones: string[];
    faultnames: string[];
    sectionnames: string[];
    strandnames: string[];

}
export const qFaultsLayerName = 'quaternaryfaults_current';
export const qFaultsWMSTitle = 'Hazardous (Quaternary age) Faults - Statewide';

const qFaultsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: qFaultsLayerName,
    title: qFaultsWMSTitle,
    visible: true,
    opacity: 1,
    sublayers: [
        {
            name: 'quaternaryfaults_current',
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


const surfaceFaultRuptureLayerName = 'surfacefaultrupture_current';
const surfaceFaultRuptureTitle = 'Surface Fault Rupture Special Study Zones';
const surfaceFaultRuptureConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: surfaceFaultRuptureLayerName,
    title: surfaceFaultRuptureTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: 'surfacefaultrupture_current',
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'sfrmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'sfrhazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
};

const windBlownSandLayerName = 'windblownsand_current';
const windBlownSandTitle = 'Wind-Blown Sand Susceptibility';
const windBlownSandConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: windBlownSandLayerName,
    title: windBlownSandTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: windBlownSandLayerName,
            queryable: true,
            popupFields: { 'Mapped Scale': { field: 'wssmappedscale', type: 'string' } },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'wsshazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const saltTectonicsDeformationLayerName = 'salttectonicsdeformation_current';
const saltTectonicsDeformationTitle = 'Salt Tectonics-Related Ground Deformation';
const saltTectonicsDeformationConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: saltTectonicsDeformationLayerName,
    title: saltTectonicsDeformationTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: saltTectonicsDeformationLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'sdhmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'sdhhazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const shallowBedrockLayerName = 'shallowbedrock_current';
const shallowBedrockTitle = 'Shallow Bedrock Potential';
const shallowBedrockConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: shallowBedrockLayerName,
    title: shallowBedrockTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: shallowBedrockLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'sbpmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'sbphazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const rockfallHazardLayerName = 'rockfall_current';
const rockfallHazardTitle = 'Rockfall Hazard';
const rockfallHazardConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: rockfallHazardLayerName,
    title: rockfallHazardTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: rockfallHazardLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'rfhmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'rfhhazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const pipingAndErosionLayerName = 'pipinganderosion_current';
const pipingAndErosionTitle = 'Piping and Erosion Susceptibility';
const pipingAndErosionConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: pipingAndErosionLayerName,
    title: pipingAndErosionTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: pipingAndErosionLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'pesmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'peshazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const expansiveSoilRockLayerName = 'expansivesoilrock_current';
const expansiveSoilRockTitle = 'Expansive Soil and Rock Susceptibility';
const expansiveSoilRockConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: expansiveSoilRockLayerName,
    title: expansiveSoilRockTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: expansiveSoilRockLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'exsmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'exshazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const shallowGroundwaterLayerName = 'shallowgroundwater_current';
const shallowGroundwaterTitle = 'Shallow Groundwater Susceptibility';
const shallowGroundwaterConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: shallowGroundwaterLayerName,
    title: shallowGroundwaterTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: shallowGroundwaterLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'sgsmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'sgshazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const radonSusceptibilityLayerName = 'radonsusceptibility_current';
const radonSusceptibilityTitle = 'Geologic Radon Susceptibility';
const radonSusceptibilityConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: radonSusceptibilityLayerName,
    title: radonSusceptibilityTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: radonSusceptibilityLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'grsmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'grshazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const corrosiveSoilRockLayerName = 'corrosivesoilrock_current';
const corrosiveSoilRockTitle = 'Corrosive Soil and Rock Susceptibility';
const corrosiveSoilRockConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: corrosiveSoilRockLayerName,
    title: corrosiveSoilRockTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: corrosiveSoilRockLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'crsmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'crshazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const collapsibleSoilLayerName = 'collapsiblesoil_current';
const collapsibleSoilTitle = 'Collapsible Soil Susceptibility';
const collapsibleSoilConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: collapsibleSoilLayerName,
    title: collapsibleSoilTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: collapsibleSoilLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'cssmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'csshazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const solubleSoilAndRockLayerName = 'solublesoilandrock_current';
const solubleSoilAndRockTitle = 'Soluble Soil and Rock Susceptibility';
const solubleSoilAndRockConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: solubleSoilAndRockLayerName,
    title: solubleSoilAndRockTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: solubleSoilAndRockLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'slsmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'slshazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const alluvialFanLayerName = 'alluvialfan_current';
const alluvialFanTitle = 'Alluvial Fan Flooding Susceptibility (Source: Division of Emergency Management)';
const alluvialFanConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: alluvialFanLayerName,
    title: alluvialFanTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: alluvialFanLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'aafmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'aafhazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const floodAndDebrisLayerName = 'floodanddebrisflow_current';
const floodAndDebrisTitle = 'Flood and Debris-Flow Hazard';
const floodAndDebrisConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: floodAndDebrisLayerName,
    title: floodAndDebrisTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: floodAndDebrisLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'flhmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'flhhazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const earthFissureLayerName = 'earthfissure_current';
const earthFissureTitle = 'Earth Fissure Hazard';
const earthFissureConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: earthFissureLayerName,
    title: earthFissureTitle,
    visible: false,
    sublayers: [
        {
            name: earthFissureLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'efhmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'efhhazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const erosionHazardZoneLayerName = 'erosionhazardzone_current';
const erosionHazardZoneTitle = 'J.E. Fuller Flood Erosion Hazard Zones';
const erosionHazardZoneConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: erosionHazardZoneLayerName,
    title: erosionHazardZoneTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: erosionHazardZoneLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'erzmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'erzhazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const karstFeaturesLayerName = 'karstfeatures_current';
const karstFeaturesTitle = 'Karst Features';
const karstFeaturesConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: karstFeaturesLayerName,
    title: karstFeaturesTitle,
    visible: false,
    sublayers: [
        {
            name: karstFeaturesLayerName,
            queryable: true,
            popupFields: {
                'Mapped Scale': { field: 'mkfmappedscale', type: 'string' },
            },
            relatedTables: [
                {
                    fieldLabel: '',
                    matchingField: 'relate_id',
                    targetField: 'mkfhazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    displayFields: [
                        { field: 'description' }
                    ]
                }
            ]
        },
    ],
}

const quads24kLayerName = '24kquads';
const quads24kWMSTitle = 'USGS 1:24,000-Scale Quadrangle Boundaries';
const quads24kWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: quads24kWMSTitle,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${GEN_GIS_WORKSPACE}:${quads24kLayerName}`,
            popupEnabled: false,
            queryable: false,
        },
    ],
}

const studyAreasLayerName = 'studyareas_current';
const studyAreasTitle = 'Mapped Areas';
const studyAreasConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    pmtilesUrl: HAZARDS_PMTILES_URL,
    styleUrl: HAZARDS_STYLE_URL,
    sourceLayer: studyAreasLayerName,
    title: studyAreasTitle,
    visible: true,
    sublayers: [
        {
            name: studyAreasLayerName,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
                'Report ID': { field: 'repor_id', type: 'string' },
                'Mapped Hazards': { field: 'hazard_name', type: 'string' },
            },
            linkFields: {
                'repor_id': {
                    baseUrl: '',
                    transform: (value: string) => {
                        const values = value.split(','); // Split the input value by a comma
                        const transformedValues = values.map(val => {
                            const trimmedVal = val.trim();
                            const href = /^\d+$/.test(trimmedVal)
                                ? `https://geodata.geology.utah.gov/pages/view.php?ref=${trimmedVal}`
                                : `https://doi.org/10.34191/${trimmedVal}`;
                            const label = trimmedVal;
                            return { label, href };
                        });

                        return transformedValues;
                    }
                }
            }
        },
    ],
}

const floodHazardsConfig: LayerProps = {
    type: 'group',
    title: 'Flooding Hazards',
    visible: false,
    layers: [floodAndDebrisConfig, shallowGroundwaterConfig, alluvialFanConfig],
};

const earthquakesConfig: LayerProps = {
    type: 'group',
    title: 'Earthquake Hazards',
    visible: true,
    layers: [qFaultsConfig, surfaceFaultRuptureConfig, liquefactionConfig, groundshakingWMSConfig],
};

const landslidesConfig: LayerProps = {
    type: 'group',
    title: 'Landslide Hazards',
    visible: false,
    layers: [rockfallHazardConfig, landslideInventoryConfig, landslideSusceptibilityConfig, landslideLegacyConfig],
};

const soilHazardsConfig: LayerProps = {
    type: 'group',
    title: 'Problem Soil and Rock Hazards',
    visible: false,
    layers: [collapsibleSoilConfig, corrosiveSoilRockConfig, earthFissureConfig, expansiveSoilRockConfig, erosionHazardZoneConfig, karstFeaturesConfig, pipingAndErosionConfig, radonSusceptibilityConfig, saltTectonicsDeformationConfig, shallowBedrockConfig, solubleSoilAndRockConfig, windBlownSandConfig],
};

const layersConfig: LayerProps[] = [
    earthquakesConfig,
    floodHazardsConfig,
    landslidesConfig,
    soilHazardsConfig,
    studyAreasConfig,
    quads24kWMSConfig,
];

export default layersConfig;