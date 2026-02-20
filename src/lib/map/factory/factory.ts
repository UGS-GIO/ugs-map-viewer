import { MapLibreMapFactory } from './maplibre';
import { MapFactory } from './types';

/**
 * Factory function to create a MapLibre GL JS map factory
 * @returns MapLibreMapFactory instance
 */
export function createMapFactory(): MapFactory {
  return new MapLibreMapFactory();
}

export type { MapFactory, MapInitOptions, MapInitResult } from './types';
export { MapLibreMapFactory };
