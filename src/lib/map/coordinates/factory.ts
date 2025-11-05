import type { CoordinateAdapter } from './types';
import { MapLibreCoordinateAdapter } from './maplibre';

/**
 * Creates a MapLibre GL JS coordinate adapter
 */
export function createCoordinateAdapter(): CoordinateAdapter {
    return new MapLibreCoordinateAdapter();
}
