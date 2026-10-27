// Off: 3D pulls ~1.9 MB of DEM tiles, roughly doubling a phone's first load on slow 4G
export const DEFAULT_TERRAIN = false;

/** Per-app 3D default (terrain + hillshade); the URL only records a choice that differs from it. */
const APP_TERRAIN: Record<string, boolean> = {
  hazards: DEFAULT_TERRAIN,
  'hazards-review': DEFAULT_TERRAIN,
  carbonstorage: DEFAULT_TERRAIN,
  geophysics: DEFAULT_TERRAIN,
  minerals: DEFAULT_TERRAIN,
  subsurface: DEFAULT_TERRAIN,
  wetlands: DEFAULT_TERRAIN,
  wetlandplants: DEFAULT_TERRAIN,
};

/** Resolve an app's 3D default from its route segment (e.g. 'hazards'). */
export function resolveAppTerrain(page: string): boolean {
  return APP_TERRAIN[page] ?? DEFAULT_TERRAIN;
}
