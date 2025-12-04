/**
 * Basemap Styles Configuration
 * - OpenFreeMap: https://openfreemap.org/
 * - Sentinel-2: https://s2maps.eu
 */

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
    id: 'outdoor',
    title: 'Outdoor',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    type: 'short',
  },
  {
    id: 'none',
    title: 'None',
    url: '', // Empty URL for no basemap
    type: 'short',
  },
  {
    id: 'satellite',
    title: 'Satellite',
    // Sentinel-2 cloudless satellite imagery
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
    type: 'short',
  },
  {
    id: 'positron',
    title: 'Light',
    url: 'https://tiles.openfreemap.org/styles/positron',
    type: 'short',
  },

  // Dropdown basemaps (long)
  {
    id: 'bright',
    title: 'Bright',
    url: 'https://tiles.openfreemap.org/styles/bright',
    type: 'long',
  },
  {
    id: 'ugrc-terrain',
    title: 'UGRC Terrain',
    url: 'https://gis.utah.gov/discover/resources/styles/terrain.json',
    type: 'long',
  },
  {
    id: 'ugrc-lite',
    title: 'UGRC Lite',
    url: 'https://gis.utah.gov/discover/resources/styles/lite.json',
    type: 'long',
  },
  {
    id: 'ugrc-overlay',
    title: 'UGRC Overlay',
    url: 'https://gis.utah.gov/discover/resources/styles/overlay.json',
    type: 'long',
  },
  {
    id: 'ugrc-topo',
    title: 'UGRC Topo',
    url: 'https://gis.utah.gov/discover/resources/styles/topo.json',
    type: 'long',
  },
  {
    id: 'ugrc-color-ir',
    title: 'UGRC Color IR',
    url: 'https://gis.utah.gov/discover/resources/styles/color-ir.json',
    type: 'long',
  },
];

// Default basemap
export const DEFAULT_BASEMAP = BASEMAP_STYLES[0]; // outdoor
