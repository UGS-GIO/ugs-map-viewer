import { PROD_GEOSERVER_URL, HAZARDS_WORKSPACE, PROD_POSTGREST_URL, GEN_GIS_WORKSPACE } from "@/lib/constants";
import { LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";
import GeoJSON from "geojson";

export const landslideLegacyLayerName = 'landslidelegacy_current';
const landslideLegacyWMSTitle = 'Legacy Landslide Compilation - Statewide';
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

const landslideInventoryLayerName = 'landslideinventory_current';
const landslideInventoryWMSTitle = 'Landslides';
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

const landslideSusceptibilityLayerName = 'landslidesusceptibility_current';
const landslideSusceptibilityWMSTitle = 'Landslide Susceptibility';
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

const liquefactionLayerName = 'liquefaction_current';
const liquefactionWMSTitle = 'Liquefaction Susceptibility';
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

// TODO: explore refactor to display peak ground acceleration like the imagery layer
const groundshakingLayerName = 'groundshaking_current';
const groundshakingWMSTitle = 'Earthquake Ground Shaking - Statewide';
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
            popupFields: {
                // empty in favor or using the rasterSource
            },
            rasterSource: {
                url: `${PROD_GEOSERVER_URL}wms`,
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
                '': { field: 'usgs_link', type: 'string', transform: (link: string | null) => link },
            },
            linkFields: {
                'usgs_link': {
                    transform: (usgsLink: string | null) => {
                        return [
                            {
                                label: 'Detailed Report',
                                href: usgsLink || ''
                            }
                        ];
                    }
                }
            },
            schema: 'hazards'
        },
    ],
};


const surfaceFaultRuptureLayerName = 'surfacefaultrupture_current';
const surfaceFaultRuptureWMSTitle = 'Surface Fault Rupture Special Study Zones';
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

const windBlownSandLayerName = 'windblownsand_current';
const windBlownSandWMSTitle = 'Wind-Blown Sand Susceptibility';
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

const saltTectonicsDeformationLayerName = 'salttectonicsdeformation_current';
const saltTectonicsDeformationWMSTitle = 'Salt Tectonics-Related Ground Deformation';
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

const shallowBedrockLayerName = 'shallowbedrock_current';
const shallowBedrockWMSTitle = 'Shallow Bedrock Potential';
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

const rockfallHazardLayerName = 'rockfall_current';
const rockfallHazardWMSTitle = 'Rockfall Hazard';
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

const pipingAndErosionLayerName = 'pipinganderosion_current';
const pipingAndErosionWMSTitle = 'Piping and Erosion Susceptibility';
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

const expansiveSoilRockLayerName = 'expansivesoilrock_current';
const expansiveSoilRockWMSTitle = 'Expansive Soil and Rock Susceptibility';
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

const shallowGroundwaterLayerName = 'shallowgroundwater_current';
const shallowGroundwaterWMSTitle = 'Shallow Groundwater Susceptibility';
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
            // new popup fields
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
const radonSusceptibilityWMSTitle = 'Geologic Radon Susceptibility';
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

const corrosiveSoilRockLayerName = 'corrosivesoilrock_current';
const corrosiveSoilRockWMSTitle = 'Corrosive Soil and Rock Susceptibility';
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

const collapsibleSoilLayerName = 'collapsiblesoil_current';
const collapsibleSoilWMSTitle = 'Collapsible Soil Susceptibility';
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

const solubleSoilAndRockLayerName = 'solublesoilandrock_current';
const solubleSoilAndRockWMSTitle = 'Soluble Soil and Rock Susceptibility';
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

const alluvialFanLayerName = 'alluvialfan_current';
const alluvialFanWMSTitle = 'Alluvial Fan Flooding Susceptibility (Source: Division of Emergency Management)';
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

const floodAndDebrisLayerName = 'floodanddebrisflow_current';
const floodAndDebrisWMSTitle = 'Flood and Debris-Flow Hazard';
const floodAndDebrisWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: floodAndDebrisWMSTitle,
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
                    fieldLabel: 'hazard_symbology_text',
                    matchingField: 'Relate_ID',
                    targetField: 'flhhazardunit',
                    url: `${PROD_POSTGREST_URL}/unit_descriptions`,
                    headers: {
                        "Accept-Profile": 'hazards',
                        "Accept": "application/json",
                        "Cache-Control": "no-cache",
                    },
                }
            ]
        },
    ],
}

const earthFissureLayerName = 'earthfissure_current';
const earthFissureWMSTitle = 'Earth Fissure Hazard';
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

const erosionHazardZoneLayerName = 'erosionhazardzone_current';
const erosionHazardZoneWMSTitle = 'J.E. Fuller Flood Erosion Hazard Zones';
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

const karstFeaturesLayerName = 'karstfeatures_current';
const karstFeaturesWMSTitle = 'Karst Features';
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

const quads24kLayerName = '24kquads';
const quads24kWMSTitle = 'USGS 1:24,000-Scale Quadrangle Boundaries';
const quads24kWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: quads24kWMSTitle,
    visible: false,
    sublayers: [
        {
            name: `${GEN_GIS_WORKSPACE}:${quads24kLayerName}`,
            popupEnabled: false,
            queryable: false,
        },
    ],
}

const studyAreasLayerName = 'studyareas_current';
const studyAreasWMSTitle = 'Mapped Areas';
const studyAreasWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: studyAreasWMSTitle,
    visible: false,
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
    layers: [floodAndDebrisWMSConfig, shallowGroundwaterWMSConfig, alluvialFanWMSConfig],
};

const earthquakesConfig: LayerProps = {
    type: 'group',
    title: 'Earthquake Hazards',
    visible: false,
    layers: [qFaultsWMSConfig, surfaceFaultRuptureWMSConfig, liquefactionWMSConfig, groundshakingWMSConfig],
};

const landslidesConfig: LayerProps = {
    type: 'group',
    title: 'Landslide Hazards',
    visible: false,
    layers: [rockfallHazardWMSConfig, landslideInventoryWMSConfig, landslideSusceptibilityWMSConfig, landslideLegacyWMSConfig],
};

const soilHazardsConfig: LayerProps = {
    type: 'group',
    title: 'Problem Soil and Rock Hazards',
    visible: false,
    layers: [collapsibleSoilWMSConfig, corrosiveSoilRockWMSConfig, earthFissureWMSConfig, expansiveSoilRockWMSConfig, erosionHazardZoneWMSConfig, karstFeaturesWMSConfig, pipingAndErosionWMSConfig, radonSusceptibilityWMSConfig, saltTectonicsDeformationWMSConfig, shallowBedrockWMSConfig, solubleSoilAndRockWMSConfig, windBlownSandWMSConfig],
};

const layersConfig: LayerProps[] = [
    earthquakesConfig,
    floodHazardsConfig,
    landslidesConfig,
    soilHazardsConfig,
    studyAreasWMSConfig,
    quads24kWMSConfig,
];

export default layersConfig;