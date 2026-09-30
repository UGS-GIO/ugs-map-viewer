import { parquetUrl } from "@/lib/constants";
import { ArcGISMapServerLayerProps, LayerProps, PMTilesLayerProps, WMSLayerProps } from "@/lib/types/mapping-types";

export const PROD_GEOSERVER_URL = 'https://ugs-geoserver-prod-flbcoqv7oa-uc.a.run.app/geoserver';
const WETLANDS_WORKSPACE = 'wetlands';


// Wetlands Mapping Layer Configurations
const wetMetaLayerName = 'wetlands_wetlands_metadata';
const wetMetaTitle = 'Wetland Project Information';
const wetMetaConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: wetMetaLayerName,
    pmtilesUrl: '',
    sourceLayer: wetMetaLayerName,
    title: wetMetaTitle,
    visible: false,
    opacity: 0.75,
    styleUrl: `data:application/json,${encodeURIComponent(
        JSON.stringify({
            layers: [
                {
                    id: 'wetlands_wetlands_metadata-fill',
                    type: 'fill',
                    paint: {
                        'fill-color': '#8A6D3B',
                        'fill-opacity': 0.35,
                        'fill-outline-color': '#333333'
                    }
                }
            ]
        })
    )}`,
    sublayers: [
        {
            name: wetMetaLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Image Year': { field: 'image_yr', type: 'string' },
                'Image Date': { field: 'image_date', type: 'string' },
                'Image Decade': { field: 'decade', type: 'string' },
                'Image Scale': { field: 'all_scales', type: 'string' },
                'Supplemental Map Info': { field: 'suppmapinfo', type: 'string' }
            },
            linkFields: {
                'suppmapinfo': {
                    baseUrl: '',
                    transform: (value: string) => {
                        if (value === 'None') {
                            const transformedValues = {
                                href: '',
                                label: 'Not currently available'
                            };
                            return [transformedValues];
                        } else {
                            // the value is a url that needs to be transformed into href and label for the link
                            const parts = value.split("/").pop() || 'Unknown';
                            const transformedValues = {
                                href: value,
                                label: `${parts}`
                            };
                            return [transformedValues];
                        }
                    }
                }
            }
        }
    ]
};

const wetNonRiverineLayerName = 'wetlands_nonriverine';
const wetNonRiverineTitle = 'Wetlands (non-riverine)';
const wetNonRiverineConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: wetNonRiverineLayerName,
    pmtilesUrl: '',
    sourceLayer: wetNonRiverineLayerName,
    title: wetNonRiverineTitle,
    visible: true,
    opacity: 0.75,
    styleUrl: `data:application/json,${encodeURIComponent(
        JSON.stringify({
            layers: [
                {
                    id: 'wetlands_nonriverine-fill',
                    type: 'fill',
                    paint: {
                        'fill-color': [
                            'match',
                            ['get', 'wetland_type'],
                            'Freshwater Emergent Wetland',
                            '#B4D79E',
                            'Freshwater Forested/Shrub Wetland',
                            '#FFD37F',
                            'Freshwater Pond',
                            '#BEE8FF',
                            'Lake',
                            '#73B2FF',
                            '#D0D0D0'
                        ],
                        'fill-opacity': 0.65,
                        'fill-outline-color': 'rgba(0,0,0,0.2)'
                    }
                }
            ]
        })
    )}`,
    sublayers: [
        {
            name: wetNonRiverineLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Cowardin Attribute': { field: 'attribute', type: 'string' },
                'Wetland Type': { field: 'wetland_type', type: 'string' },
                'Acres': {
                    field: 'acres', type: 'number',
                    transform: (value: number | null) => {
                        if (value === null) {
                            return null;
                        }
                        return (Math.round((value + Number.EPSILON) * 100) / 100).toString();
                    }
                },
                'Image Year': { field: 'image_yr', type: 'string' },
                'Additional Attributes Available': { field: 'llww', type: 'string' }
            }
        }
    ]
};

const riverineLayerName = 'wetlands_riverine';
const riverineTitle = 'Riverine';
const riverineConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: riverineLayerName,
    pmtilesUrl: '',
    sourceLayer: riverineLayerName,
    title: riverineTitle,
    visible: false,
    opacity: 0.75,
    styleUrl: `data:application/json,${encodeURIComponent(
        JSON.stringify({
            layers: [
                {
                    id: 'wetlands_riverine-fill',
                    type: 'fill',
                    paint: {
                        'fill-color': '#016100',
                        'fill-opacity': 0.65,
                        'fill-outline-color': 'rgba(0,0,0,0.3)'
                    }
                }
            ]
        })
    )}`,
    sublayers: [
        {
            name: riverineLayerName,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Cowardin Attribute': { field: 'attribute', type: 'string' },
                'Wetland Type': { field: 'wetland_type', type: 'string' },
                'Acres': {
                    field: 'acres', type: 'number',
                    transform: (value: number | null) => {
                        if (value === null) {
                            return null;
                        }
                        return (Math.round((value + Number.EPSILON) * 100) / 100).toString();
                    }
                },
                'Image Year': { field: 'image_yr', type: 'string' },
                'Additional Attributes Available': { field: 'llww', type: 'string' }
            }
        }
    ]
};

// Wetlands Group Layer
const wetlandGroupConfig: LayerProps = {
    type: 'group',
    title: 'Wetland Mapping',
    visible: true,
    layers: [
        wetMetaConfig,
        wetNonRiverineConfig,
        riverineConfig
    ]
};

const ripMetaLayerName = 'wetlandsapp_riparian_metadata';
const ripMetaTitle = 'Riparian Project Information';
const ripMetaConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: ripMetaTitle,
    visible: false,
    opacity: 0.75,
    crs: 'EPSG:26912',
    downloadParquetUrl: parquetUrl("wetlandsapp_riparian_metadata"),
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${ripMetaLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Image Year': { field: 'image_yr', type: 'string' },
                'Image Date': { field: 'image_date', type: 'string' },
                'Image Decade': { field: 'decade', type: 'string' },
                'Image Scale': { field: 'all_scales', type: 'string' },
                'Supplemental Map Info': { field: 'suppmapinfo', type: 'string' }
            },
            linkFields: {
                'suppmapinfo': {
                    baseUrl: '',
                    transform: (value: string) => {
                        // the value is a url that needs to be transformed into href and label for the link
                        const parts = value.split("/").pop()
                        const transformedValues = {
                            href: value,
                            label: `${parts}`
                        };
                        return [transformedValues];
                    }
                }
            }
        }
    ]
};

const ripDataLayerName = 'wetlandsapp_riparian';
const ripDataTitle = 'Riparian Mapping';
const
    ripDataConfig: WMSLayerProps = {
        type: 'wms',
        url: `${PROD_GEOSERVER_URL}/wms`,
        title: ripDataTitle,
        visible: true,
        opacity: 0.75,
    crs: 'EPSG:26912',
        downloadParquetUrl: parquetUrl("wetlandsapp_riparian"),
        sublayers: [
            {
                name: `${WETLANDS_WORKSPACE}:${ripDataLayerName}`,
                popupEnabled: false,
                queryable: true,
                popupFields: {
                    'Attribute': { field: 'attribute', type: 'string' },
                    'Riparian Type': { field: 'wetland_type', type: 'string' },
                    'Acres': {
                        field: 'acres', type: 'number',
                        transform: (value: number | null) => {
                            if (value === null) {
                                return null;
                            }
                            return (Math.round((value + Number.EPSILON) * 100) / 100).toString();
                        }
                    },
                    'Image Year': { field: 'image_yr', type: 'string' }
                }
            }
        ]
    };

// Wetlands Group Layer
const riparianGroupConfig: LayerProps = {
    type: 'group',
    title: 'Riparian Data',
    visible: false,
    layers: [
        ripMetaConfig,
        ripDataConfig
    ]
};

// LLWW descriptions or metadata (calcluated project area)
const llwwMappingLayerName = 'wetlandsapp_finalfunction_calculated_projectarea';
const llwwMappingTitle = 'LLWW Descriptions';
const llwwMappingConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: llwwMappingTitle,
    visible: true,
    opacity: 0.75,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${llwwMappingLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Cowardin Attribute': { field: 'cowattribute', type: 'string' },
                'LLWW Feature Type': { field: 'featuretype', type: 'string' },
                'HGM': { field: 'hgm_class', type: 'string' },
                'Landscape': { field: 'landscape', type: 'string' },
                'Landform or Waterbody': { field: 'landform_waterbody', type: 'string' },
                'Flowpath': { field: 'flowpath', type: 'string' },
                'LLWW Base Code': { field: 'llww_base', type: 'string' },
                'LLWW Modifiers': { field: 'llww_modifiers', type: 'string' }
            }
        }
    ]
};

// cache project areas
const cacheProjectsLayerName = 'wetlandsapp_llww_mappingareas';
const cacheProjectsTitle = 'LLWW Mapping Areas';
const cacheProjectsConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: cacheProjectsTitle,
    visible: true,
    opacity: 0.75,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${cacheProjectsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Project Name': { field: 'projectname', type: 'string' },
                'Organization': { field: 'organization', type: 'string' },
                'Base Imagery': { field: 'baseimagery', type: 'string' },
                'Supplemental Report': { field: 'report', type: 'string' },
            },
            linkFields: {
                'report': {
                    baseUrl: '',
                    transform: (value: string) => {
                        // the value is a url that needs to be transformed into href and label for the link
                        const parts = value.split("/").pop()
                        const transformedValues = {
                            href: value,
                            label: `${parts}`
                        };
                        return [transformedValues];
                    }
                }
            }
        }
    ]
};

// Additional Attributes Group Layer
const additonalGroupConfig: LayerProps = {
    type: 'group',
    title: 'Additional Attributes (LLWW)',
    visible: false,
    layers: [llwwMappingConfig, cacheProjectsConfig]
};

// Hydric Soils Classes (Soil_Hydric_Classes/0)
// Still need to impliment image server layers
/*
const hydricSoilsTitle = 'Hydric Soils Classes';
const hydricSoilsConfig: LayerProps = {
    type: 'feature',
    url: "https://utility.arcgis.com/usrsvcs/servers/771b11ef2a574ce9a3a2351b758498fa/rest/services/USA_Soils_Hydric_Class/ImageServer",
    title: hydricSoilsTitle,
    visible: false,
    opacity: 0.7,
};
*/

// Wetland Assessment Projects  (Wetland_Condition/0)
const assessmentLayerName = 'wetlandsapp_wetlandassessmentprojects';
const assessmentTitle = 'Wetland Assessment Projects';
const assessmentConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    visible: true,
    opacity: 0.6,
    title: assessmentTitle,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${assessmentLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Project Name': { field: 'project', type: 'string' },
                'Years': { field: 'years', type: 'string' },
                'Report': { field: 'projectreport', type: 'string' },
                'Target population': { field: 'target_population', type: 'string' },
                'Target population comparison': { field: 'target_population_comparison', type: 'string' },
                'Sample frame': { field: 'sample_frame', type: 'string' },
                'Site selection': { field: 'site_selection', type: 'string' }
            },
            linkFields: {
                'projectreport': {
                    baseUrl: '',
                    transform: (value: string) => {
                        // the value is a url that needs to be transformed into href and label for the link
                        const parts = value.split("/").pop()
                        const transformedValues = {
                            href: value,
                            label: `${parts}`
                        };
                        return [transformedValues];
                    }
                }
            }
        }
    ]
};

// Wetland Assessment Study Results  (Wetland_Condition/2)
const wetlandsWMSLayerName = 'wetlandsapp_wetlandassessmentstudyresults';
const wetlandsWMSTitle = 'Wetland Assessment Study Results';
const wetlandsWMSConfig: LayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: wetlandsWMSTitle,
    visible: false,
    opacity: 0.6,
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${wetlandsWMSLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Project Name': { field: 'project', type: 'string' },
                'Stratum Name': { field: 'stratum_name', type: 'string' },
                'Stratum Ecoregion': { field: 'stratum_ecoregion', type: 'string' },
                'Sites Surveyed (#)': { field: 'sites_surveyed', type: 'string' },
                'Very High Condition Score (%)': { field: 'pct_very_high_condition', type: 'string' },
                'High Condition Score (%)': { field: 'pct_high_condition', type: 'string' },
                'Medium Condition Score (%)': { field: 'pct_medium_condition', type: 'string' },
                'Low Condition Score (%)': { field: 'pct_low_condition', type: 'string' },
                'Stressors Absent (%)': { field: 'pct_absent_oveall_stress', type: 'string' },
                'Stressors Low (%)': { field: 'pct_low_overall_stress', type: 'string' },
                'Stressors Medium (%)': { field: 'pct_med_overall_stress', type: 'string' },
                'Stressors High (%)': { field: 'pct_high_overall_stress', type: 'string' },
                'Stressors Very High (%)': { field: 'pct_very_high_overall_stress', type: 'string' },
                'Mean Relative Native Plant Cover (%)': { field: 'mean_rel_native_cov', type: 'string' },
                'Mean Absolute Noxious Plant Cover (%)': { field: 'mean_abs_nox_cov', type: 'string' }
            }
        }
    ]
};


const stressorsLayerName = 'wetlandsapp_wetlandstressors';
const stressorsTitle = 'Wetland Stressors';
const stressorsConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: stressorsTitle,
    visible: false,
    opacity: 0.6,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${stressorsLayerName}`,
            popupEnabled: false,
            queryable: true,
            // no popups for this layer
        }
    ]
};

// Wetlands Group Layer
const wetConditionGroupConfig: LayerProps = {
    type: 'group',
    title: 'Wetland Condition',
    visible: false,
    layers: [assessmentConfig, wetlandsWMSConfig, stressorsConfig]
};

// SITLA Land Ownership Layer (ArcGIS MapServer)
const ownershipConfig: ArcGISMapServerLayerProps = {
    type: 'map-image',
    url: 'https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership_WM/MapServer',
    title: 'Land Ownership',
    opacity: 0.5,
    visible: false,
};

// landscape ecoregions
const huc12ecoLayerName = 'wetlandsapp_huc12_ecoregion';
const huc12ecoTitle = 'Watershed (HUC12) by Ecoregion';
const huc12ecoConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: huc12ecoTitle,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${huc12ecoLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Watershed Name:': { field: 'huc12_name', type: 'string' },
                'Watershed Identifier:': { field: 'huc12', type: 'string' },
                'Ecoregion:': { field: 'ecoregion', type: 'string' },
                'Surface Water Plot:': { field: 'surface_water_plot', type: 'string' }
            },
            linkFields: {
                'surface_water_plot': {
                    baseUrl: '',
                    transform: (value: string) => {
                        const transformedValues = {
                            href: value,
                            label: `Open in a new tab`
                        };
                        return [transformedValues];
                    }
                }
            }
        }
    ]
};


// HUC 12
const huc12LayerName = 'wetlandsapp_huc12';
const huc12Title = 'Watershed (HUC12)';
const huc12Config: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: huc12Title,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${huc12LayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Watershed Name:': { field: 'huc12_name', type: 'string' },
                'Watershed Identifier:': { field: 'huc12', type: 'string' },
                'Surface Water Plot:': { field: 'surface_water_plot', type: 'string' }
            },
            linkFields: {
                'surface_water_plot': {
                    baseUrl: '',
                    transform: (value: string) => {
                        const transformedValues = {
                            href: value,
                            label: `Open in a new tab`
                        };
                        return [transformedValues];
                    }
                }
            }
        }
    ]
};

// HUC 8
const huc8ecoLayerName = 'wetlandsapp_huc8_ecoregion';
const huc8ecoTitle = 'Sub-Basin (HUC8) by Ecoregion';
const huc8ecoConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: huc8ecoTitle,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${huc8ecoLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Sub-basin Name:': { field: 'huc8_name', type: 'string' },
                'Sub-basin Identifier:': { field: 'huc8', type: 'string' },
                'Ecoregion:': { field: 'ecoregion', type: 'string' },
                'Surface Water Plot:': { field: 'surface_water_plot', type: 'string' }
            },
            linkFields: {
                'surface_water_plot': {
                    baseUrl: '',
                    transform: (value: string) => {
                        const transformedValues = {
                            href: value,
                            label: `Open in a new tab`
                        };
                        return [transformedValues];
                    }
                }
            }
        }
    ]
};


// HUC 8
const huc8LayerName = 'wetlandsapp_huc8';
const huc8Title = 'Sub-Basin (HUC8)';
const huc8Config: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: huc8Title,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${huc8LayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Sub-basin Name:': { field: 'huc8_name', type: 'string' },
                'Sub-basin Identifier:': { field: 'huc8', type: 'string' },
                'Surface Water Plot:': { field: 'surface_water_plot', type: 'string' }
            },
            linkFields: {
                'surface_water_plot': {
                    baseUrl: '',
                    transform: (value: string) => {
                        const transformedValues = {
                            href: value,
                            label: `Open in a new tab`
                        };
                        return [transformedValues];
                    }
                }
            }
        }
    ]
};

// Ecoregion
const ecoregionLayerName = 'wetlandsapp_ecoregion';
const ecoregionTitle = 'Ecoregion';
const ecoregionConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: ecoregionTitle,
    visible: false,
    crs: 'EPSG:26912',
    sublayers: [
        {
            name: `${WETLANDS_WORKSPACE}:${ecoregionLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Ecoregion:': { field: 'ecoregion', type: 'string' }
            }
        }
    ]
};

// Wetlands Group Layer
const ecoregionsGroupConfig: LayerProps = {
    type: 'group',
    title: 'Landscape Ecoregion Data',
    visible: false,
    layers: [huc12ecoConfig, huc12Config, huc8ecoConfig, huc8Config, ecoregionConfig]
};


const layersConfig: LayerProps[] = [
    wetlandGroupConfig,
    riparianGroupConfig,
    additonalGroupConfig,
    //hydricSoilsConfig,
    wetConditionGroupConfig,
    ownershipConfig,
    ecoregionsGroupConfig
];

export default layersConfig;