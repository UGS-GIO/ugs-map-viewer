export const PROD_GEOSERVER_URL = 'https://ugs-geoserver-prod-flbcoqv7oa-uc.a.run.app/geoserver';
export const PROD_POSTGREST_URL = 'https://postgrest-seamlessgeolmap-734948684426.us-central1.run.app';
export const HAZARDS_WORKSPACE = 'hazards';
export const ENERGY_MINERALS_WORKSPACE = 'energy_mineral';
export const GEN_GIS_WORKSPACE = 'gen_gis';
export const MAPPING_WORKSPACE = 'mapping';
export const GEOCODE_PROXY_FUNCTION_URL = 'http://127.0.0.1:5001/ut-dnr-ugs-maps-dev/us-central1/geocodeProxy';
export const MASQUERADE_GEOCODER_URL = 'https://masquerade.ugrc.utah.gov/arcgis/rest/services/UtahLocator/GeocodeServer';
export const MAPS_ASSETS_CDN_URL = 'https://maps-assets.geology.utah.gov';
/** UCRC core photo CDN. In dev, swapped to a Vite proxy path so cross-origin fetches work without prod CORS. */
export const UCRC_ASSETS_CDN_URL = import.meta.env.DEV
    ? '/ucrc-assets'
    : 'https://ucrc-assets.geology.utah.gov';

/**
 * Build a CDN URL for a layer's GeoParquet file. Layers follow the convention
 * `parquet/{name}/{name}.parquet` — pass `name` (the table/layer stem) once.
 */
export const parquetUrl = (name: string) => `${MAPS_ASSETS_CDN_URL}/parquet/${name}/${name}.parquet`;

/**
 * Routes that serve unmodified source data and therefore offer no data export.
 * These already pass `disableExport` to their Layers / map container; this list is
 * what the Info panel's dataset downloads honour, since it mounts route-agnostically.
 */
export const EXPORT_DISABLED_PAGES: readonly string[] = ['hazards'];

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
    'subsurface': [{
        tableName: 'ucrclayerinfo',
        acceptProfile: 'emp'
    }],
    'geophysics': [{
        tableName: 'geophysicslayerinfo',
        acceptProfile: 'emp'
    }],
};

export const POPUP_TITLES: Record<string, string> = {
    hazards: 'Hazards in your area',
    'hazards-review': 'Hazards in your area',
    minerals: 'Mineral Resources',
    wetlands: 'Wetlands',
    wetlandplants: 'Wetland Plants',
    geophysics: 'Geophysical Features',
    carbonstorage: 'CCS Information',
}

export const getLayerFetchConfig = (page: string | null): LayerFetchConfig[] | null => {
    if (!page) return null;
    return layerFetchConfigs[page] || layerFetchConfigs['default'] || null;
};