import { PROD_GEOSERVER_URL, HAZARDS_WORKSPACE, PROD_POSTGREST_URL } from "@/lib/constants";
import { LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";
import GeoJSON from "geojson";

// ## 1. Define the placeholder CQL filter constant
export const IS_REVIEW_CQL = "is_review = 'R'";

// --- Original Layer Definitions ---

export const landslideLegacyLayerName = 'landslidelegacy_review';
const landslideLegacyWMSTitle = 'Legacy Landslide Compilation - Statewide: Review';
const landslideLegacyWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: landslideLegacyWMSTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${landslideLegacyLayerName}`,
            popupEnabled: false,
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

const landslideInventoryLayerName = 'landslideinventory_review';
const landslideInventoryWMSTitle = 'Landslides: Review';
const landslideInventoryWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: landslideInventoryWMSTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${landslideInventoryLayerName}`,
            popupEnabled: false,
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

const landslideSusceptibilityLayerName = 'landslidesusceptibility_review';
const landslideSusceptibilityWMSTitle = 'Landslide Susceptibility: Review';
const landslideSusceptibilityWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: landslideSusceptibilityWMSTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${landslideSusceptibilityLayerName}`,
            popupEnabled: false,
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

const liquefactionLayerName = 'liquefaction_review';
const liquefactionWMSTitle = 'Liquefaction Susceptibility: Review';
const liquefactionWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: liquefactionWMSTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${liquefactionLayerName}`,
            popupEnabled: false,
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

const groundshakingLayerName = 'groundshaking_review';
const groundshakingWMSTitle = 'Earthquake Ground Shaking - Statewide: Review';
const groundshakingWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: groundshakingWMSTitle,
    visible: false,
    opacity: 0.5,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${groundshakingLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {},
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
export const qFaultsLayerName = 'quaternaryfaults_review';
export const qFaultsWMSTitle = 'Hazardous (Quaternary age) Faults - Statewide: Review';
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
                '': { field: 'usgs_link', type: 'string' },
            },
            linkFields: {
                'usgs_link': {
                    transform: (usgsLink: unknown) => {
                        if (!usgsLink) return [];
                        return [{ label: 'Detailed Report', href: `${usgsLink}` }];
                    }
                }
            },
            schema: 'hazards'
        },
    ],
};

const surfaceFaultRuptureLayerName = 'surfacefaultrupture_review';
const surfaceFaultRuptureWMSTitle = 'Surface Fault Rupture Special Study Zones: Review';
const surfaceFaultRuptureWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: surfaceFaultRuptureWMSTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${surfaceFaultRuptureLayerName}`,
            popupEnabled: false,
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
}

const windBlownSandLayerName = 'windblownsand_review';
const windBlownSandWMSTitle = 'Wind-Blown Sand Susceptibility: Review';
const windBlownSandWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: windBlownSandWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${windBlownSandLayerName}`,
            popupEnabled: false,
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

const saltTectonicsDeformationLayerName = 'salttectonicsdeformation_review';
const saltTectonicsDeformationWMSTitle = 'Salt Tectonics-Related Ground Deformation: Review';
const saltTectonicsDeformationWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: saltTectonicsDeformationWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${saltTectonicsDeformationLayerName}`,
            popupEnabled: false,
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

const shallowBedrockLayerName = 'shallowbedrock_review';
const shallowBedrockWMSTitle = 'Shallow Bedrock Potential: Review';
const shallowBedrockWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: shallowBedrockWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${shallowBedrockLayerName}`,
            popupEnabled: false,
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

const rockfallHazardLayerName = 'rockfall_review';
const rockfallHazardWMSTitle = 'Rockfall Hazard: Review';
const rockfallHazardWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: rockfallHazardWMSTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${rockfallHazardLayerName}`,
            popupEnabled: false,
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

const pipingAndErosionLayerName = 'pipinganderosion_review';
const pipingAndErosionWMSTitle = 'Piping and Erosion Susceptibility: Review';
const pipingAndErosionWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: pipingAndErosionWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${pipingAndErosionLayerName}`,
            popupEnabled: false,
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

const expansiveSoilRockLayerName = 'expansivesoilrock_review';
const expansiveSoilRockWMSTitle = 'Expansive Soil and Rock Susceptibility: Review';
const expansiveSoilRockWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: expansiveSoilRockWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${expansiveSoilRockLayerName}`,
            popupEnabled: false,
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

const shallowGroundwaterLayerName = 'shallowgroundwater_review';
const shallowGroundwaterWMSTitle = 'Shallow Groundwater Susceptibility: Review';
const shallowGroundwaterWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: shallowGroundwaterWMSTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${shallowGroundwaterLayerName}`,
            popupEnabled: false,
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

const radonSusceptibilityLayerName = 'radonsusceptibility_review';
const radonSusceptibilityWMSTitle = 'Geologic Radon Susceptibility: Review';
const radonSusceptibilityWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: radonSusceptibilityWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${radonSusceptibilityLayerName}`,
            popupEnabled: false,
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

const corrosiveSoilRockLayerName = 'corrosivesoilrock_review';
const corrosiveSoilRockWMSTitle = 'Corrosive Soil and Rock Susceptibility: Review';
const corrosiveSoilRockWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: corrosiveSoilRockWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${corrosiveSoilRockLayerName}`,
            popupEnabled: false,
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

const collapsibleSoilLayerName = 'collapsiblesoil_review';
const collapsibleSoilWMSTitle = 'Collapsible Soil Susceptibility: Review';
const collapsibleSoilWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: collapsibleSoilWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${collapsibleSoilLayerName}`,
            popupEnabled: false,
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

const solubleSoilAndRockLayerName = 'solublesoilandrock_review';
const solubleSoilAndRockWMSTitle = 'Soluble Soil and Rock Susceptibility: Review';
const solubleSoilAndRockWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: solubleSoilAndRockWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${solubleSoilAndRockLayerName}`,
            popupEnabled: false,
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

const alluvialFanLayerName = 'alluvialfan_review';
const alluvialFanWMSTitle = 'Alluvial Fan Flooding Susceptibility (Source: Division of Emergency Management): Review';
const alluvialFanWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: alluvialFanWMSTitle,
    visible: false,
    opacity: 0.75,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${alluvialFanLayerName}`,
            popupEnabled: false,
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

const floodAndDebrisLayerName = 'floodanddebrisflow_review';
const floodAndDebrisWMSTitle = 'Flood and Debris-Flow Hazard: Review';
const floodAndDebrisWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: floodAndDebrisWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${floodAndDebrisLayerName}`,
            popupEnabled: false,
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

const earthFissureLayerName = 'earthfissure_review';
const earthFissureWMSTitle = 'Earth Fissure Hazard: Review';
const earthFissureWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: earthFissureWMSTitle,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${earthFissureLayerName}`,
            popupEnabled: false,
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

const erosionHazardZoneLayerName = 'erosionhazardzone_review';
const erosionHazardZoneWMSTitle = 'J.E. Fuller Flood Erosion Hazard Zones: Review';
const erosionHazardZoneWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: erosionHazardZoneWMSTitle,
    opacity: 0.75,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${erosionHazardZoneLayerName}`,
            popupEnabled: false,
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

const karstFeaturesLayerName = 'karstfeatures_review';
const karstFeaturesWMSTitle = 'Karst Features: Review';
const karstFeaturesWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: karstFeaturesWMSTitle,
    visible: false,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${karstFeaturesLayerName}`,
            popupEnabled: false,
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

// const quads24kLayerName = '24kquads';
// const quads24kWMSTitle = 'USGS 1:24,000-Scale Quadrangle Boundaries: Review';
// const quads24kWMSConfig: WMSLayerProps = {
//     type: 'wms',
//     url: `${PROD_GEOSERVER_URL}/wms`,
//     title: quads24kWMSTitle,
//     visible: false,
//     sublayers: [
//         {
//             name: `${GEN_GIS_WORKSPACE}:${quads24kLayerName}`,
//             popupEnabled: false,
//             queryable: false,
//         },
//     ],
// }

const studyAreasLayerName = 'studyareas_review';
const studyAreasWMSTitle = 'Mapped Areas: Review';
const studyAreasWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: studyAreasWMSTitle,
    visible: true,
    sublayers: [
        {
            name: `${HAZARDS_WORKSPACE}:${studyAreasLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
                'Report ID': { field: 'repor_id', type: 'string' },
                'Mapped Hazards': { field: 'hazard_name', type: 'string' },
            },
            linkFields: {
                'repor_id': {
                    baseUrl: '',
                    transform: (value: unknown) => {
                        if (!value) return [];
                        const values = (value as string).split(',');
                        return values.map(val => {
                            const trimmedVal = val.trim();
                            const href = /^\d+$/.test(trimmedVal)
                                ? `https://geodata.geology.utah.gov/pages/view.php?ref=${trimmedVal}`
                                : `https://doi.org/10.34191/${trimmedVal}`;
                            return { label: trimmedVal, href };
                        });
                    }
                }
            }
        },
    ],
}

const floodHazardsConfig: LayerProps = {
    type: 'group',
    title: 'Flooding Hazards: Review',
    visible: false,
    layers: [floodAndDebrisWMSConfig, shallowGroundwaterWMSConfig, alluvialFanWMSConfig],
};

const earthquakesConfig: LayerProps = {
    type: 'group',
    title: 'Earthquake Hazards: Review',
    visible: false,
    layers: [qFaultsWMSConfig, surfaceFaultRuptureWMSConfig, liquefactionWMSConfig, groundshakingWMSConfig],
};

const landslidesConfig: LayerProps = {
    type: 'group',
    title: 'Landslide Hazards: Review',
    visible: false,
    layers: [rockfallHazardWMSConfig, landslideInventoryWMSConfig, landslideSusceptibilityWMSConfig, landslideLegacyWMSConfig],
};

const soilHazardsConfig: LayerProps = {
    type: 'group',
    title: 'Problem Soil and Rock Hazards: Review',
    visible: false,
    layers: [
        collapsibleSoilWMSConfig,
        corrosiveSoilRockWMSConfig,
        earthFissureWMSConfig,
        expansiveSoilRockWMSConfig,
        erosionHazardZoneWMSConfig,
        karstFeaturesWMSConfig,
        pipingAndErosionWMSConfig,
        radonSusceptibilityWMSConfig,
        saltTectonicsDeformationWMSConfig,
        shallowBedrockWMSConfig,
        solubleSoilAndRockWMSConfig,
        windBlownSandWMSConfig
    ],
};

const layersConfig: LayerProps[] = [
    earthquakesConfig,
    floodHazardsConfig,
    landslidesConfig,
    soilHazardsConfig,
    studyAreasWMSConfig,
    // quads24kWMSConfig,
];

// --- New "Review" Versions of Each Layer Config ---
export const landslideLegacyReviewConfig: WMSLayerProps = { ...landslideLegacyWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const landslideInventoryReviewConfig: WMSLayerProps = { ...landslideInventoryWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const landslideSusceptibilityReviewConfig: WMSLayerProps = { ...landslideSusceptibilityWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const liquefactionReviewConfig: WMSLayerProps = { ...liquefactionWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const groundshakingReviewConfig: WMSLayerProps = { ...groundshakingWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const qFaultsReviewConfig: WMSLayerProps = { ...qFaultsWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const surfaceFaultRuptureReviewConfig: WMSLayerProps = { ...surfaceFaultRuptureWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const windBlownSandReviewConfig: WMSLayerProps = { ...windBlownSandWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const saltTectonicsDeformationReviewConfig: WMSLayerProps = { ...saltTectonicsDeformationWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const shallowBedrockReviewConfig: WMSLayerProps = { ...shallowBedrockWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const rockfallHazardReviewConfig: WMSLayerProps = { ...rockfallHazardWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const pipingAndErosionReviewConfig: WMSLayerProps = { ...pipingAndErosionWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const expansiveSoilRockReviewConfig: WMSLayerProps = { ...expansiveSoilRockWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const shallowGroundwaterReviewConfig: WMSLayerProps = { ...shallowGroundwaterWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const radonSusceptibilityReviewConfig: WMSLayerProps = { ...radonSusceptibilityWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const corrosiveSoilRockReviewConfig: WMSLayerProps = { ...corrosiveSoilRockWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const collapsibleSoilReviewConfig: WMSLayerProps = { ...collapsibleSoilWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const solubleSoilAndRockReviewConfig: WMSLayerProps = { ...solubleSoilAndRockWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const alluvialFanReviewConfig: WMSLayerProps = { ...alluvialFanWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const earthFissureReviewConfig: WMSLayerProps = { ...earthFissureWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const erosionHazardZoneReviewConfig: WMSLayerProps = { ...erosionHazardZoneWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const karstFeaturesReviewConfig: WMSLayerProps = { ...karstFeaturesWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };
export const studyAreasReviewConfig: WMSLayerProps = { ...studyAreasWMSConfig, customLayerParameters: { cql_filter: IS_REVIEW_CQL } };

// --- New "Review" Groupings Using the Filtered Layers ---
export const floodHazardsReviewConfig: LayerProps = { ...floodHazardsConfig, layers: [shallowGroundwaterReviewConfig, alluvialFanReviewConfig] };
export const earthquakesReviewConfig: LayerProps = { ...earthquakesConfig, layers: [qFaultsReviewConfig, surfaceFaultRuptureReviewConfig, liquefactionReviewConfig, groundshakingReviewConfig] };
export const landslidesReviewConfig: LayerProps = { ...landslidesConfig, layers: [rockfallHazardReviewConfig, landslideInventoryReviewConfig, landslideSusceptibilityReviewConfig, landslideLegacyReviewConfig] };
export const soilHazardsReviewConfig: LayerProps = { ...soilHazardsConfig, layers: [collapsibleSoilReviewConfig, corrosiveSoilRockReviewConfig, earthFissureReviewConfig, expansiveSoilRockReviewConfig, erosionHazardZoneReviewConfig, karstFeaturesReviewConfig, pipingAndErosionReviewConfig, radonSusceptibilityReviewConfig, saltTectonicsDeformationReviewConfig, shallowBedrockReviewConfig, solubleSoilAndRockReviewConfig, windBlownSandWMSConfig] };

// --- New, Separate Config Array for Review Layers ---
export const reviewLayersConfig: LayerProps[] = [
    earthquakesReviewConfig,
    floodHazardsReviewConfig,
    landslidesReviewConfig,
    soilHazardsReviewConfig,
    studyAreasReviewConfig,
    // quads24kWMSConfig, // This layer is for reference and does not have/need a filter
];

// The original default export
export default layersConfig;