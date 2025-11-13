export const PROD_GEOSERVER_URL = 'https://ugs-geoserver-prod-flbcoqv7oa-uc.a.run.app/geoserver/';
export const PROD_POSTGREST_URL = 'https://postgrest-seamlessgeolmap-734948684426.us-central1.run.app';
export const HAZARDS_WORKSPACE = 'hazards';
export const ENERGY_MINERALS_WORKSPACE = 'energy_mineral';
export const GEN_GIS_WORKSPACE = 'gen_gis';
export const MAPPING_WORKSPACE = 'mapping';
export const GEOCODE_PROXY_FUNCTION_URL = 'http://127.0.0.1:5001/ut-dnr-ugs-maps-dev/us-central1/geocodeProxy';
export const MASQUERADE_GEOCODER_URL = 'https://masquerade.ugrc.utah.gov/arcgis/rest/services/UtahLocator/GeocodeServer';

// Constants for symbol generation
export const SYMBOL_CONSTANTS = {
    SVG_WIDTH: 32,
    SVG_HEIGHT: 20,
    LINE_Y_CENTER: 10,
    LINE_START_X: 2,
    LINE_END_X: 30,
    MIN_LINE_WIDTH: 2,
    LINE_WIDTH_ENHANCEMENT: 1,
    TRIANGLE_HEIGHT: 6,
    TRIANGLE_COUNT: 4,
    PATTERN_TILE_SIZE: 8,
    POINT_TO_PIXEL_RATIO: 4 / 3,
    IMAGE_SCALING_RATIO: 5 / 4,
    MAX_POINT_SIZE: 17,
    DEFAULT_POINT_SIZE: 16
} as const;

export interface LayerFetchConfig {
    tableName: string;
    acceptProfile: string;
}

export const layerFetchConfigs: Record<string, LayerFetchConfig[]> = {
    'hazards': [{
        tableName: 'hazlayerinfo',
        acceptProfile: 'hazards'
    }],
    'hazards-review': [
        {
            tableName: 'hazlayerinfo',
            acceptProfile: 'hazards'
        },
        {
            tableName: 'hazlayerreviewinfo',
            acceptProfile: 'hazards'
        }
    ],
    'carbonstorage': [{
        tableName: 'ccuslayerinfo',
        acceptProfile: 'emp'
    }],
};

export const getLayerFetchConfig = (page: string | null): LayerFetchConfig[] | null => {
    if (!page) return null;
    return layerFetchConfigs[page] || layerFetchConfigs['default'] || null;
};