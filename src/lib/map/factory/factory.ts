import { MapLibreMapFactory } from './maplibre';
import { MapFactory } from './types';
import { getMapImplementation } from '../get-map-implementation';

/**
 * Factory function to create the appropriate map factory provider
 * based on the active map implementation
 *
 * @returns The appropriate MapFactory instance
 */
export function createMapFactory(): MapFactory {
  const implementation = getMapImplementation();

  if (implementation === 'maplibre') {
    return new MapLibreMapFactory();
  }

  // Dynamically load ArcGIS factory to avoid CSS import errors in tests
  try {
    // Use require with relative path resolution for CommonJS compatibility
    const arcgisModule = require('./arcgis.ts');
    const { ArcGISMapFactory } = arcgisModule;
    return new ArcGISMapFactory();
  } catch {
    // Fallback: return MapLibre factory if ArcGIS loading fails (useful in tests)
    return new MapLibreMapFactory();
  }
}

export type { MapFactory, MapInitOptions, MapInitResult } from './types';
export { MapLibreMapFactory };
