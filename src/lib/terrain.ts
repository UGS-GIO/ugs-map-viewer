export interface AppTerrainConfig {
  terrain: boolean;
  hillshade: boolean;
}

// Off: both pull ~1.9 MB of DEM tiles, roughly doubling a phone's first load on slow 4G
export const DEFAULT_TERRAIN: AppTerrainConfig = { terrain: false, hillshade: false };

/** Per-app defaults for the Terrain card; the URL only records a choice that differs from these. */
const APP_TERRAIN: Record<string, AppTerrainConfig> = {
  hazards: DEFAULT_TERRAIN,
  'hazards-review': DEFAULT_TERRAIN,
  carbonstorage: DEFAULT_TERRAIN,
  geophysics: DEFAULT_TERRAIN,
  minerals: DEFAULT_TERRAIN,
  subsurface: DEFAULT_TERRAIN,
  wetlands: DEFAULT_TERRAIN,
  wetlandplants: DEFAULT_TERRAIN,
};

/** Resolve an app's terrain defaults from its route segment (e.g. 'hazards'). */
export function resolveAppTerrain(page: string): AppTerrainConfig {
  return APP_TERRAIN[page] ?? DEFAULT_TERRAIN;
}
