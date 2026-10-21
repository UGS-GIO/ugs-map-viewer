/**
 * Basemap Styles Configuration
 *
 * UGRC Discover (Utah): https://gis.utah.gov/products/discover/
 * - Requires quad-word authentication
 * - Provides raster WMTS tiles for Utah-specific basemaps
 *
 * OpenFreeMap: https://openfreemap.org/
 * - Open source vector tile basemaps
 *
 * Sentinel-2: https://s2maps.eu
 * - Cloudless satellite imagery
 */

import type { StyleSpecification, RasterSourceSpecification } from 'maplibre-gl';

// UGRC Discover quad-word for authenticated access
const UGRC_QUAD_WORD = 'nebula-east-focus-virgo';
const UGRC_BASE_URL = `https://discover.agrc.utah.gov/login/path/${UGRC_QUAD_WORD}`;
const UGRC_ATTRIBUTION = '© <a href="https://gis.utah.gov">UGRC</a>';

export interface BasemapStyle {
  id: string;
  title: string;
  url: string;
  type: 'short' | 'long'; // short = main nav, long = dropdown
  /** Basemap id drawn beneath; only useful when this style's tiles are transparent outside Utah. */
  underlay?: string;
  /** Credit for raster tiles; vector styles carry their own. */
  attribution?: string;
}

// All available basemap styles
export const BASEMAP_STYLES: BasemapStyle[] = [
  // Main navigation basemaps (short) - non-clipped global basemaps first
  {
    id: 'liberty',
    title: 'Streets',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    type: 'short',
  },
  {
    id: 'sentinel',
    title: 'Satellite',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
    attribution: '© Sentinel-2 by EOX',
    type: 'short',
  },
  {
    id: 'lite',
    title: 'Lite',
    url: `${UGRC_BASE_URL}/tiles/lite_basemap/{z}/{x}/{y}`,
    attribution: UGRC_ATTRIBUTION,
    type: 'short',
  },
  {
    id: 'terrain',
    title: 'Terrain',
    url: `${UGRC_BASE_URL}/tiles/terrain_basemap/{z}/{x}/{y}`,
    attribution: UGRC_ATTRIBUTION,
    type: 'short',
  },

  // Dropdown basemaps (long) - Utah-specific UGRC maps
  {
    id: 'hybrid',
    title: 'Hybrid',
    underlay: 'sentinel',
    url: `${UGRC_BASE_URL}/tiles/hybrid_basemap/{z}/{x}/{y}`,
    attribution: UGRC_ATTRIBUTION,
    type: 'long',
  },
  {
    id: 'satellite',
    title: 'Satellite',
    underlay: 'sentinel',
    url: `${UGRC_BASE_URL}/tiles/utah/{z}/{x}/{y}`,
    attribution: UGRC_ATTRIBUTION,
    type: 'long',
  },
  {
    id: 'none',
    title: 'None',
    url: '',
    type: 'long',
  },
];

// Default basemap
export const DEFAULT_BASEMAP = BASEMAP_STYLES[0];

/** Resolve a basemap by id; throws (fail loud) if the id isn't in BASEMAP_STYLES. */
function getBasemap(id: string): BasemapStyle {
  const style = BASEMAP_STYLES.find((b) => b.id === id);
  if (!style) throw new Error(`Unknown basemap id: ${id}`);
  return style;
}

export function getBasemapUrl(id: string): string {
  return getBasemap(id).url;
}

// Underlay alone below this zoom, Utah tiles alone at or above it.
const UNDERLAY_SWAP_ZOOM = 8;

const isRasterUrl = (url: string) => url.includes('{z}') && url.includes('{x}') && url.includes('{y}');

function rasterSource({ url, attribution }: BasemapStyle): RasterSourceSpecification {
  return { type: 'raster', tiles: [url], tileSize: 256, attribution };
}

/** MapLibre style for a basemap: a vector style URL as-is, or raster tiles (plus any underlay). */
export function buildBasemapStyle(style: BasemapStyle): string | StyleSpecification {
  if (!style.url) {
    return {
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f0f0f0' } }],
    };
  }
  if (!isRasterUrl(style.url)) return style.url;

  const underlay = style.underlay ? getBasemap(style.underlay) : undefined;
  return {
    version: 8,
    sources: {
      ...(underlay && { 'underlay-tiles': rasterSource(underlay) }),
      'raster-tiles': rasterSource(style),
    },
    layers: [
      ...(underlay
        ? [
            { id: 'underlay-layer', type: 'raster' as const, source: 'underlay-tiles', maxzoom: UNDERLAY_SWAP_ZOOM },
            { id: 'raster-layer', type: 'raster' as const, source: 'raster-tiles', minzoom: UNDERLAY_SWAP_ZOOM },
          ]
        : [{ id: 'raster-layer', type: 'raster' as const, source: 'raster-tiles' }]),
    ],
  };
}

export interface AppBasemapConfig {
  default: string;
  /** Top-level nav buttons, in this order; the rest move to "More". */
  short?: string[];
  hide?: string[];
}

/** Every app, so the table is the whole story. An app left out falls back to all styles + `DEFAULT_BASEMAP`. */
const STANDARD_SHORT = ['liberty', 'sentinel', 'lite', 'terrain'];

/** Hazards reads landforms off UGRC's current statewide imagery; Sentinel-2's 2020 mosaic is too coarse for it. */
const HAZARDS_BASEMAPS: AppBasemapConfig = {
  default: 'satellite',
  short: ['liberty', 'satellite', 'lite', 'terrain'],
  hide: ['sentinel'],
};

const APP_BASEMAPS: Record<string, AppBasemapConfig> = {
  hazards: HAZARDS_BASEMAPS,
  'hazards-review': { ...HAZARDS_BASEMAPS, default: 'lite' },
  carbonstorage: { default: 'liberty', short: STANDARD_SHORT },
  geophysics: { default: 'liberty', short: STANDARD_SHORT },
  minerals: { default: 'liberty', short: STANDARD_SHORT },
  subsurface: { default: 'liberty', short: STANDARD_SHORT },
  wetlands: { default: 'liberty', short: STANDARD_SHORT },
  wetlandplants: { default: 'liberty', short: STANDARD_SHORT },
  flux: { default: 'liberty', short: STANDARD_SHORT },
};

export interface AppBasemaps {
  styles: BasemapStyle[];
  defaultStyle: BasemapStyle;
}

/** Resolve an app's basemap menu from its route segment (e.g. 'hazards'). */
export function resolveAppBasemaps(page: string): AppBasemaps {
  const config = APP_BASEMAPS[page];
  if (!config) return { styles: BASEMAP_STYLES, defaultStyle: DEFAULT_BASEMAP };

  const hidden = new Set(config.hide ?? []);
  const short = config.short ?? BASEMAP_STYLES.filter(b => b.type === 'short').map(b => b.id);
  const visible = BASEMAP_STYLES
    .filter(b => !hidden.has(b.id))
    .map((b): BasemapStyle => ({ ...b, type: short.includes(b.id) ? 'short' : 'long' }));

  const styles = [
    ...short.map(id => visible.find(b => b.id === id)).filter((b): b is BasemapStyle => b !== undefined),
    ...visible.filter(b => b.type === 'long'),
  ];
  return { styles, defaultStyle: styles.find(b => b.id === config.default) ?? DEFAULT_BASEMAP };
}
