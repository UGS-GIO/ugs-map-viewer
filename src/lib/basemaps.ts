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

// UGRC Discover quad-word for authenticated access
const UGRC_QUAD_WORD = 'nebula-east-focus-virgo';
const UGRC_BASE_URL = `https://discover.agrc.utah.gov/login/path/${UGRC_QUAD_WORD}`;

export interface BasemapStyle {
  id: string;
  title: string;
  url: string;
  type: 'short' | 'long'; // short = main nav, long = dropdown
}

// All available basemap styles
export const BASEMAP_STYLES: BasemapStyle[] = [
  // Main navigation basemaps (short)
  {
    id: 'lite',
    title: 'Lite',
    url: `${UGRC_BASE_URL}/tiles/lite_basemap/{z}/{x}/{y}`,
    type: 'short',
  },
  {
    id: 'terrain',
    title: 'Terrain',
    url: `${UGRC_BASE_URL}/tiles/terrain_basemap/{z}/{x}/{y}`,
    type: 'short',
  },
  {
    id: 'satellite',
    title: 'Satellite',
    url: `${UGRC_BASE_URL}/tiles/utah/{z}/{x}/{y}`,
    type: 'short',
  },
  {
    id: 'topo',
    title: 'Topo',
    url: `${UGRC_BASE_URL}/tiles/topo_basemap/{z}/{x}/{y}`,
    type: 'short',
  },

  // Dropdown basemaps (long)
  {
    id: 'hybrid',
    title: 'Hybrid',
    url: `${UGRC_BASE_URL}/tiles/hybrid_basemap/{z}/{x}/{y}`,
    type: 'long',
  },
  {
    id: 'sentinel',
    title: 'Sentinel-2',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
    type: 'long',
  },
  {
    id: 'liberty',
    title: 'OpenFreeMap',
    url: 'https://tiles.openfreemap.org/styles/liberty',
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
