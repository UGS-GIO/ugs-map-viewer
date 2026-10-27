export interface AppTerrainConfig {
  terrain: boolean;
  hillshade: boolean;
}

export const DEFAULT_TERRAIN: AppTerrainConfig = { terrain: true, hillshade: true };

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
