import { HAZARDS_WORKSPACE } from "@/lib/constants";

// Hazard codes from the first config file
export const groundshakingHazardCode = 'EGS';
export const quaternaryFaultsHazardCode = 'QFF';

// This map directly links a hazard code to its GeoServer layer name string.
export const hazardLayerNameMap = {
    // Earthquake Hazards
    [quaternaryFaultsHazardCode]: `${HAZARDS_WORKSPACE}:hazards_qfaults_current`,
    'SFR': `${HAZARDS_WORKSPACE}:hazards_surfacefaultrupture_current`,
    'LQS': `${HAZARDS_WORKSPACE}:liquefaction_current`,
    [groundshakingHazardCode]: `${HAZARDS_WORKSPACE}:groundshaking_current`,

    // Flooding Hazards
    'FLH': `${HAZARDS_WORKSPACE}:floodanddebrisflow_current`,
    'SGS': `${HAZARDS_WORKSPACE}:shallowgroundwater_current`,
    'ERZ': `${HAZARDS_WORKSPACE}:erosionhazardzone_current`,
    'AAF': `${HAZARDS_WORKSPACE}:alluvialfan_current`,

    // Landslide Hazards
    'RFH': `${HAZARDS_WORKSPACE}:rockfall_current`,
    'LSF': `${HAZARDS_WORKSPACE}:landslideinventory_current`,
    'LSS': `${HAZARDS_WORKSPACE}:landslidesusceptibility_current`,
    'LSC': `${HAZARDS_WORKSPACE}:landslidelegacy_current`,

    // Problem Soil and Rock Hazards
    'CSS': `${HAZARDS_WORKSPACE}:collapsiblesoil_current`,
    'CRS': `${HAZARDS_WORKSPACE}:corrosivesoilrock_current`,
    'EFH': `${HAZARDS_WORKSPACE}:earthfissure_current`,
    'EXS': `${HAZARDS_WORKSPACE}:expansivesoilrock_current`,
    'MKF': `${HAZARDS_WORKSPACE}:karstfeatures_current`,
    'PES': `${HAZARDS_WORKSPACE}:pipinganderosion_current`,
    'GRS': `${HAZARDS_WORKSPACE}:radonsusceptibility_current`,
    'SDH': `${HAZARDS_WORKSPACE}:salttectonicsdeformation_current`,
    'SBP': `${HAZARDS_WORKSPACE}:shallowbedrock_current`,
    'SLS': `${HAZARDS_WORKSPACE}:solublesoilandrock_current`,
    'WSS': `${HAZARDS_WORKSPACE}:windblownsand_current`,
};

// Geometry field names per layer (default is 'shape', override where different)
// TODO: All layers will eventually migrate to 'geom'
const geometryFieldOverrides: Record<string, string> = {
    [quaternaryFaultsHazardCode]: 'geom',
};

// Native CRS per layer (default is EPSG:26912, override where different)
// TODO: All layers will eventually migrate to EPSG:3857
const crsOverrides: Record<string, string> = {
    [quaternaryFaultsHazardCode]: 'EPSG:3857',
};

/**
 * Get the geometry field name for a hazard code
 * @param hazardCode - The hazard code (e.g., 'QFF', 'LQS')
 * @returns The geometry field name ('geom' or 'shape')
 */
export function getGeometryField(hazardCode: string): string {
    return geometryFieldOverrides[hazardCode] || 'shape';
}

/**
 * Get the native CRS for a hazard code
 * @param hazardCode - The hazard code (e.g., 'QFF', 'LQS')
 * @returns The EPSG code (e.g., 'EPSG:26912', 'EPSG:3857')
 */
export function getLayerCRS(hazardCode: string): string {
    return crsOverrides[hazardCode] || 'EPSG:26912';
}