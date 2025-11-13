import { HAZARDS_WORKSPACE } from "@/lib/constants";

// Hazard codes from the first config file
export const groundshakingHazardCode = 'EGS';
export const quaternaryFaultsHazardCode = 'QFF';

// This map directly links a hazard code to its GeoServer layer name string.
export const hazardLayerNameMap = {
    // Earthquake Hazards
    [quaternaryFaultsHazardCode]: `${HAZARDS_WORKSPACE}:quaternaryfaults_test`,
    'LQS': `${HAZARDS_WORKSPACE}:liquefaction_current`,
    'SFR': `${HAZARDS_WORKSPACE}:surfacefaultrupture_current`,
    [groundshakingHazardCode]: `${HAZARDS_WORKSPACE}:groundshaking_current`,

    // Flooding Hazards
    'FLH': `${HAZARDS_WORKSPACE}:floodanddebrisflow_current`,
    'SGS': `${HAZARDS_WORKSPACE}:shallowgroundwater_current`,
    'AAF': `${HAZARDS_WORKSPACE}:alluvialfan_current`,

    // Landslide Hazards
    'LSS': `${HAZARDS_WORKSPACE}:landslidesusceptibility_current`,
    'LSF': `${HAZARDS_WORKSPACE}:landslideinventory_current`,
    'LSC': `${HAZARDS_WORKSPACE}:landslidelegacy_current`,
    'RFH': `${HAZARDS_WORKSPACE}:rockfall_current`,

    // Problem Soil and Rock Hazards
    'CSS': `${HAZARDS_WORKSPACE}:collapsiblesoil_current`,
    'CRS': `${HAZARDS_WORKSPACE}:corrosivesoilrock_current`,
    'EFH': `${HAZARDS_WORKSPACE}:earthfissure_current`,
    'ERZ': `${HAZARDS_WORKSPACE}:erosionhazardzone_current`,
    'EXS': `${HAZARDS_WORKSPACE}:expansivesoilrock_current`,
    'MKF': `${HAZARDS_WORKSPACE}:karstfeatures_current`,
    'PES': `${HAZARDS_WORKSPACE}:pipinganderosion_current`,
    'GRS': `${HAZARDS_WORKSPACE}:radonsusceptibility_current`,
    'SDH': `${HAZARDS_WORKSPACE}:salttectonicsdeformation_current`,
    'SBP': `${HAZARDS_WORKSPACE}:shallowbedrock_current`,
    'SLS': `${HAZARDS_WORKSPACE}:solublesoilandrock_current`,
    'WSS': `${HAZARDS_WORKSPACE}:windblownsand_current`,
};