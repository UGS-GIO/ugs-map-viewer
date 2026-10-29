/** AWS Terrarium DEM tiles, used for 3D terrain, hillshade and measure elevations. */
export const TERRARIUM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export const DEFAULT_TERRAIN = true;

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
export function resolveAppTerrain(page: string, isPhone: boolean): boolean {
  // Phones load flat: 3D pulls ~1.9 MB of DEM tiles, roughly doubling a first load on slow 4G
  if (isPhone) return false;
  return APP_TERRAIN[page] ?? DEFAULT_TERRAIN;
}
