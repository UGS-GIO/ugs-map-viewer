export interface MapPoint {
    x: number;
    y: number;
    crs?: string; // e.g., "EPSG:4326", "EPSG:3857"
}

export interface ScreenPoint {
    x: number;
    y: number;
}

export interface BoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

import type { MapLibreMap } from '@/lib/types/map-types';

/** Coordinate transformation interface for MapLibre */
export interface CoordinateAdapter {
    screenToMap(screenPoint: ScreenPoint, map: MapLibreMap): MapPoint;
    mapToScreen(mapPoint: MapPoint, map: MapLibreMap): ScreenPoint;
    createBoundingBox(params: { mapPoint: MapPoint; resolution: number; buffer: number }): BoundingBox;
    toJSON(point: MapPoint | null): Record<string, unknown> | null;
    getViewBounds(map: MapLibreMap): BoundingBox;
    getResolution(map: MapLibreMap): number;
}
