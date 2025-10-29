import type { CoordinateAdapter, ScreenPoint, MapPoint, BoundingBox } from './types';

/** MapLibre coordinate transformation (WGS84/4326) */
export class MapLibreCoordinateAdapter implements CoordinateAdapter {
    screenToMap(screenPoint: ScreenPoint, map: any): MapPoint {
        try {
            if (!map?.unproject) throw new Error('Invalid MapLibre map instance');
            const lngLat = map.unproject([screenPoint.x, screenPoint.y]);
            return { x: lngLat.lng, y: lngLat.lat, spatialReference: { wkid: 4326 } };
        } catch (error) {
            console.error('MapLibre screenToMap conversion failed:', error);
            return { x: 0, y: 0, spatialReference: { wkid: 4326 } };
        }
    }

    createBoundingBox({ mapPoint, resolution, buffer }: { mapPoint: MapPoint; resolution: number; buffer: number }): BoundingBox {
        const degreesBuffer = buffer * resolution;
        return {
            minX: mapPoint.x - degreesBuffer,
            minY: mapPoint.y - degreesBuffer,
            maxX: mapPoint.x + degreesBuffer,
            maxY: mapPoint.y + degreesBuffer,
        };
    }

    toJSON(point: MapPoint | null): any {
        return point ? { x: point.x, y: point.y, spatialReference: point.spatialReference } : null;
    }

    mapToScreen(mapPoint: MapPoint, map: any): ScreenPoint {
        try {
            if (!map?.project) throw new Error('Invalid MapLibre map instance');
            const screenCoords = map.project([mapPoint.x, mapPoint.y]);
            return { x: screenCoords.x, y: screenCoords.y };
        } catch (error) {
            console.error('MapLibre mapToScreen conversion failed:', error);
            return { x: 0, y: 0 };
        }
    }

    getViewBounds(map: any): BoundingBox {
        try {
            if (!map?.getBounds) throw new Error('Invalid MapLibre map instance');
            const bounds = map.getBounds();
            return {
                minX: bounds.getWest(),
                minY: bounds.getSouth(),
                maxX: bounds.getEast(),
                maxY: bounds.getNorth()
            };
        } catch (error) {
            console.error('MapLibre getViewBounds failed:', error);
            return { minX: -180, minY: -90, maxX: 180, maxY: 90 };
        }
    }

    getResolution(map: any): number {
        try {
            if (!map?.getZoom) throw new Error('Invalid MapLibre map instance');
            const zoom = map.getZoom();
            const metersPerPixel = (40075017 / (256 * Math.pow(2, zoom))) * Math.cos(0);
            return metersPerPixel / 111320;
        } catch (error) {
            console.error('MapLibre getResolution failed:', error);
            return 0.0001;
        }
    }
}
