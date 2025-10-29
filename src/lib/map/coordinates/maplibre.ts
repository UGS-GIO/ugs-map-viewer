import type { CoordinateAdapter, ScreenPoint, MapPoint, BoundingBox } from './types';
import proj4 from 'proj4';

// Define projections using standard EPSG definitions
const WGS84 = 'EPSG:4326';
const WEB_MERCATOR = 'EPSG:3857';

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
        // Convert point from geographic (4326) to Web Mercator (3857) using proj4
        const [mercatorX, mercatorY] = proj4(WGS84, WEB_MERCATOR, [mapPoint.x, mapPoint.y]);

        // Calculate buffer in Web Mercator meters (resolution is already in meters/pixel)
        const metersBuffer = buffer * resolution;

        return {
            minX: mercatorX - metersBuffer,
            minY: mercatorY - metersBuffer,
            maxX: mercatorX + metersBuffer,
            maxY: mercatorY + metersBuffer,
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
            // Return resolution in meters per pixel (Web Mercator projection)
            // Formula: earthCircumference / (tileSize * 2^zoom)
            // Where: earthCircumference = 40075017m, tileSize = 256px (standard Web Mercator)
            const EARTH_CIRCUMFERENCE = 40075017;
            const TILE_SIZE = 256;
            const metersPerPixel = (EARTH_CIRCUMFERENCE / (TILE_SIZE * Math.pow(2, zoom)));
            return metersPerPixel;
        } catch (error) {
            console.error('MapLibre getResolution failed:', error);
            return 1;
        }
    }
}
