import type { CoordinateAdapter } from './types';
import { ArcGISCoordinateAdapter } from './arcgis';
import { MapLibreCoordinateAdapter } from './maplibre';

/**
 * Creates a coordinate transformer for the specified map library
 * @throws Error if mapType is not recognized
 */
export function createCoordinateAdapter(mapType: 'arcgis' | 'maplibre'): CoordinateAdapter {
    switch (mapType) {
        case 'arcgis':
            return new ArcGISCoordinateAdapter();
        case 'maplibre':
            return new MapLibreCoordinateAdapter();
        default:
            throw new Error(`Unknown map type: ${mapType}`);
    }
}
