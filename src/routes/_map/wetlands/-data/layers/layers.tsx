import {
  ArcGISMapServerLayerProps,
  LayerProps,
  LinkDefinition,
  PMTilesLayerProps,
} from '@/lib/types/mapping-types'

const createFilenameLinkTransform = (
  value: string | null | undefined
): LinkDefinition[] => {
  if (!value || value === 'None') {
    return [
      {
        href: '',
        label: 'Not currently available',
      },
    ]
  }
  const parts = value.split('/').pop() || 'Unknown'
  return [
    {
      href: value,
      label: parts,
    },
  ]
}

const createPlotLinkTransform = (
  value: string | null | undefined
): LinkDefinition[] => {
  if (!value) {
    return [
      {
        href: '',
        label: 'Not available',
      },
    ]
  }
  return [
    {
      href: value,
      label: 'Open in a new tab',
    },
  ]
}

// Wetlands Mapping Layer Configurations
const wetMetaLayerName = 'wetlands_wetlands_metadata'
const wetMetaTitle = 'Wetland Project Information'
const wetMetaConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: wetMetaLayerName,
  pmtilesUrl: '',
  sourceLayer: wetMetaLayerName,
  title: wetMetaTitle,
  visible: false,
  opacity: 0.75,
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
        'Supplemental Map Info': { field: 'suppmapinfo', type: 'string' },
      },
      linkFields: {
        suppmapinfo: {
          baseUrl: '',
          transform: createFilenameLinkTransform,
        },
      },
    },
  ],
}

const wetNonRiverineLayerName = 'wetlands_nonriverine'
const wetNonRiverineTitle = 'Wetlands (non-riverine)'
const wetNonRiverineConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: wetNonRiverineLayerName,
  pmtilesUrl: '',
  sourceLayer: wetNonRiverineLayerName,
  title: wetNonRiverineTitle,
  visible: true,
  opacity: 0.75,
  sublayers: [
    {
      name: wetNonRiverineLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Cowardin Attribute': { field: 'attribute', type: 'string' },
        'Wetland Type': { field: 'wetland_type', type: 'string' },
        Acres: {
          field: 'acres',
          type: 'number',
          transform: (value: number | null) => {
            if (value === null) {
              return null
            }
            return (Math.round((value + Number.EPSILON) * 100) / 100).toString()
          },
        },
        'Image Year': { field: 'image_yr', type: 'string' },
        'Additional Attributes Available': { field: 'llww', type: 'string' },
      },
    },
  ],
}

const riverineLayerName = 'wetlands_riverine'
const riverineTitle = 'Riverine'
const riverineConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: riverineLayerName,
  pmtilesUrl: '',
  sourceLayer: riverineLayerName,
  title: riverineTitle,
  visible: false,
  opacity: 0.75,
  sublayers: [
    {
      name: riverineLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Cowardin Attribute': { field: 'attribute', type: 'string' },
        'Wetland Type': { field: 'wetland_type', type: 'string' },
        Acres: {
          field: 'acres',
          type: 'number',
          transform: (value: number | null) => {
            if (value === null) {
              return null
            }
            return (Math.round((value + Number.EPSILON) * 100) / 100).toString()
          },
        },
        'Image Year': { field: 'image_yr', type: 'string' },
        'Additional Attributes Available': { field: 'llww', type: 'string' },
      },
    },
  ],
}

// Wetlands Group Layer
const wetlandGroupConfig: LayerProps = {
  type: 'group',
  title: 'Wetland Mapping',
  visible: true,
  layers: [wetMetaConfig, wetNonRiverineConfig, riverineConfig],
}

const ripMetaLayerName = 'wetlands_riparian_metadata'
const ripMetaTitle = 'Riparian Project Information'
const ripMetaConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: ripMetaLayerName,
  pmtilesUrl: '',
  sourceLayer: ripMetaLayerName,
  title: ripMetaTitle,
  visible: false,
  opacity: 0.75,
  sublayers: [
    {
      name: ripMetaLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Image Year': { field: 'image_yr', type: 'string' },
        'Image Date': { field: 'image_date', type: 'string' },
        'Image Decade': { field: 'decade', type: 'string' },
        'Image Scale': { field: 'all_scales', type: 'string' },
        'Supplemental Map Info': { field: 'suppmapinfo', type: 'string' },
      },
      linkFields: {
        suppmapinfo: {
          baseUrl: '',
          transform: createFilenameLinkTransform,
        },
      },
    },
  ],
}

const ripDataLayerName = 'wetlands_riparian'
const ripDataTitle = 'Riparian Mapping'
const ripDataConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: ripDataLayerName,
  pmtilesUrl: '',
  sourceLayer: ripDataLayerName,
  title: ripDataTitle,
  visible: true,
  opacity: 0.75,
  sublayers: [
    {
      name: ripDataLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        Attribute: { field: 'attribute', type: 'string' },
        'Riparian Type': { field: 'wetland_type', type: 'string' },
        Acres: {
          field: 'acres',
          type: 'number',
          transform: (value: number | null) => {
            if (value === null) {
              return null
            }
            return (Math.round((value + Number.EPSILON) * 100) / 100).toString()
          },
        },
        'Image Year': { field: 'image_yr', type: 'string' },
      },
    },
  ],
}

// Wetlands Group Layer
const riparianGroupConfig: LayerProps = {
  type: 'group',
  title: 'Riparian Data',
  visible: false,
  layers: [ripMetaConfig, ripDataConfig],
}

// LLWW descriptions or metadata (calcluated project area)
const llwwMappingLayerName = 'wetlands_llww_descriptions'
const llwwMappingTitle = 'LLWW Descriptions'
const llwwMappingConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: llwwMappingLayerName,
  pmtilesUrl: '',
  sourceLayer: llwwMappingLayerName,
  title: llwwMappingTitle,
  visible: true,
  opacity: 0.75,
  sublayers: [
    {
      name: llwwMappingLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Cowardin Attribute': { field: 'cowattribute', type: 'string' },
        'LLWW Feature Type': { field: 'featuretype', type: 'string' },
        HGM: { field: 'hgm_class', type: 'string' },
        Landscape: { field: 'landscape', type: 'string' },
        'Landform or Waterbody': {
          field: 'landform_waterbody',
          type: 'string',
        },
        Flowpath: { field: 'flowpath', type: 'string' },
        'LLWW Base Code': { field: 'llww_base', type: 'string' },
        'LLWW Modifiers': { field: 'llww_modifiers', type: 'string' },
      },
    },
  ],
}

// cache project areas
const cacheProjectsLayerName = 'wetlands_llww_areas'
const cacheProjectsTitle = 'LLWW Mapping Areas'
const cacheProjectsConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: cacheProjectsLayerName,
  pmtilesUrl: '',
  sourceLayer: cacheProjectsLayerName,
  title: cacheProjectsTitle,
  visible: true,
  opacity: 0.75,
  sublayers: [
    {
      name: cacheProjectsLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Project Name': { field: 'projectname', type: 'string' },
        Organization: { field: 'organization', type: 'string' },
        'Base Imagery': { field: 'baseimagery', type: 'string' },
        'Supplemental Report': { field: 'report', type: 'string' },
      },
      linkFields: {
        report: {
          baseUrl: '',
          transform: createFilenameLinkTransform,
        },
      },
    },
  ],
}

// Additional Attributes Group Layer
const additonalGroupConfig: LayerProps = {
  type: 'group',
  title: 'Additional Attributes (LLWW)',
  visible: false,
  layers: [llwwMappingConfig, cacheProjectsConfig],
}

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
const assessmentLayerName = 'wetlands_assessment_projects'
const assessmentTitle = 'Wetland Assessment Projects'
const assessmentConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: assessmentLayerName,
  pmtilesUrl: '',
  sourceLayer: assessmentLayerName,
  visible: true,
  opacity: 0.6,
  title: assessmentTitle,
  sublayers: [
    {
      name: assessmentLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Project Name': { field: 'project', type: 'string' },
        Years: { field: 'years', type: 'string' },
        Report: { field: 'projectreport', type: 'string' },
        'Target population': { field: 'target_population', type: 'string' },
        'Target population comparison': {
          field: 'target_population_comparison',
          type: 'string',
        },
        'Sample frame': { field: 'sample_frame', type: 'string' },
        'Site selection': { field: 'site_selection', type: 'string' },
      },
      linkFields: {
        projectreport: {
          baseUrl: '',
          transform: createFilenameLinkTransform,
        },
      },
    },
  ],
}

// Wetland Assessment Study Results  (Wetland_Condition/2)
const studyResultsLayerName = 'wetlands_assessment_study_results'
const studyResultsTitle = 'Wetland Assessment Study Results'
const studyResultsConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: studyResultsLayerName,
  pmtilesUrl: '',
  sourceLayer: studyResultsLayerName,
  title: studyResultsTitle,
  visible: false,
  opacity: 0.6,
  sublayers: [
    {
      name: studyResultsLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Project Name': { field: 'project', type: 'string' },
        'Stratum Name': { field: 'stratum_name', type: 'string' },
        'Stratum Ecoregion': { field: 'stratum_ecoregion', type: 'string' },
        'Sites Surveyed (#)': { field: 'sites_surveyed', type: 'string' },
        'Very High Condition Score (%)': {
          field: 'pct_very_high_condition',
          type: 'string',
        },
        'High Condition Score (%)': {
          field: 'pct_high_condition',
          type: 'string',
        },
        'Medium Condition Score (%)': {
          field: 'pct_medium_condition',
          type: 'string',
        },
        'Low Condition Score (%)': {
          field: 'pct_low_condition',
          type: 'string',
        },
        'Stressors Absent (%)': {
          field: 'pct_absent_overall_stress',
          type: 'string',
        },
        'Stressors Low (%)': {
          field: 'pct_low_overall_stress',
          type: 'string',
        },
        'Stressors Medium (%)': {
          field: 'pct_med_overall_stress',
          type: 'string',
        },
        'Stressors High (%)': {
          field: 'pct_high_overall_stress',
          type: 'string',
        },
        'Stressors Very High (%)': {
          field: 'pct_very_high_overall_stress',
          type: 'string',
        },
        'Mean Relative Native Plant Cover (%)': {
          field: 'mean_rel_native_cov',
          type: 'string',
        },
        'Mean Absolute Noxious Plant Cover (%)': {
          field: 'mean_abs_nox_cov',
          type: 'string',
        },
      },
    },
  ],
}

const stressorsLayerName = 'wetlands_stressors'
const stressorsTitle = 'Wetland Stressors'
const stressorsConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: stressorsLayerName,
  pmtilesUrl: '',
  sourceLayer: stressorsLayerName,
  title: stressorsTitle,
  visible: false,
  opacity: 0.6,
  sublayers: [
    {
      name: stressorsLayerName,
      popupEnabled: false,
      queryable: true,
      // no popups for this layer
    },
  ],
}

// Wetlands Group Layer
const wetConditionGroupConfig: LayerProps = {
  type: 'group',
  title: 'Wetland Condition',
  visible: false,
  layers: [assessmentConfig, studyResultsConfig, stressorsConfig],
}

// SITLA Land Ownership Layer (ArcGIS MapServer)
const ownershipConfig: ArcGISMapServerLayerProps = {
  type: 'map-image',
  url: 'https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership_WM/MapServer',
  title: 'Land Ownership',
  opacity: 0.5,
  visible: false,
}

// landscape ecoregions
const huc12ecoLayerName = 'wetlands_watershed_huc12_ecoregion'
const huc12ecoTitle = 'Watershed (HUC12) by Ecoregion'
const huc12ecoConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: huc12ecoLayerName,
  pmtilesUrl: '',
  sourceLayer: huc12ecoLayerName,
  title: huc12ecoTitle,
  visible: false,
  opacity: 0.75,
  sublayers: [
    {
      name: huc12ecoLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Watershed Name:': { field: 'huc12_name', type: 'string' },
        'Watershed Identifier:': { field: 'huc12', type: 'string' },
        'Ecoregion:': { field: 'ecoregion', type: 'string' },
        'Surface Water Plot:': { field: 'surface_water_plot', type: 'string' },
      },
      linkFields: {
        surface_water_plot: {
          baseUrl: '',
          transform: createPlotLinkTransform,
        },
      },
    },
  ],
}

// HUC 12
const huc12LayerName = 'wetlands_watershed_huc12'
const huc12Title = 'Watershed (HUC12)'
const huc12Config: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: huc12LayerName,
  pmtilesUrl: '',
  sourceLayer: huc12LayerName,
  title: huc12Title,
  visible: false,
  opacity: 0.75,
  sublayers: [
    {
      name: huc12LayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Watershed Name:': { field: 'huc12_name', type: 'string' },
        'Watershed Identifier:': { field: 'huc12', type: 'string' },
        'Surface Water Plot:': { field: 'surface_water_plot', type: 'string' },
      },
      linkFields: {
        surface_water_plot: {
          baseUrl: '',
          transform: createPlotLinkTransform,
        },
      },
    },
  ],
}

// HUC 8
const huc8ecoLayerName = 'wetlands_subbasin_huc8_ecoregion'
const huc8ecoTitle = 'Sub-Basin (HUC8) by Ecoregion'
const huc8ecoConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: huc8ecoLayerName,
  pmtilesUrl: '',
  sourceLayer: huc8ecoLayerName,
  title: huc8ecoTitle,
  visible: false,
  opacity: 0.75,
  sublayers: [
    {
      name: huc8ecoLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Sub-basin Name:': { field: 'huc8_name', type: 'string' },
        'Sub-basin Identifier:': { field: 'huc8', type: 'string' },
        'Ecoregion:': { field: 'ecoregion', type: 'string' },
        'Surface Water Plot:': { field: 'surface_water_plot', type: 'string' },
      },
      linkFields: {
        surface_water_plot: {
          baseUrl: '',
          transform: createPlotLinkTransform,
        },
      },
    },
  ],
}

// HUC 8
const huc8LayerName = 'wetlands_subbasin_huc8'
const huc8Title = 'Sub-Basin (HUC8)'
const huc8Config: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: huc8LayerName,
  pmtilesUrl: '',
  sourceLayer: huc8LayerName,
  title: huc8Title,
  visible: false,
  opacity: 0.75,
  sublayers: [
    {
      name: huc8LayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Sub-basin Name:': { field: 'huc8_name', type: 'string' },
        'Sub-basin Identifier:': { field: 'huc8', type: 'string' },
        'Surface Water Plot:': { field: 'surface_water_plot', type: 'string' },
      },
      linkFields: {
        surface_water_plot: {
          baseUrl: '',
          transform: createPlotLinkTransform,
        },
      },
    },
  ],
}

// Ecoregion
const ecoregionLayerName = 'wetlands_ecoregion'
const ecoregionTitle = 'Ecoregion'
const ecoregionConfig: PMTilesLayerProps = {
  type: 'pmtiles',
  stacItemId: ecoregionLayerName,
  pmtilesUrl: '',
  sourceLayer: ecoregionLayerName,
  title: ecoregionTitle,
  visible: false,
  opacity: 0.75,
  sublayers: [
    {
      name: ecoregionLayerName,
      popupEnabled: false,
      queryable: true,
      popupFields: {
        'Ecoregion:': { field: 'ecoregion', type: 'string' },
      },
    },
  ],
}

// Wetlands Group Layer
const ecoregionsGroupConfig: LayerProps = {
  type: 'group',
  title: 'Landscape Ecoregion Data',
  visible: false,
  layers: [
    huc12ecoConfig,
    huc12Config,
    huc8ecoConfig,
    huc8Config,
    ecoregionConfig,
  ],
}

const layersConfig: LayerProps[] = [
  wetlandGroupConfig,
  riparianGroupConfig,
  additonalGroupConfig,
  //hydricSoilsConfig,
  wetConditionGroupConfig,
  ownershipConfig,
  ecoregionsGroupConfig,
]

export default layersConfig
