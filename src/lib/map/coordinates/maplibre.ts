import type { CoordinateAdapter, ScreenPoint, MapPoint, BoundingBox } from './types';
import type { MapLibreMap } from '@/lib/types/map-types';

const WGS84 = 'EPSG:4326';

/** MapLibre coordinate transformation (WGS84/4326) */
export class MapLibreCoordinateAdapter implements CoordinateAdapter {
    screenToMap(screenPoint: ScreenPoint, map: MapLibreMap): MapPoint {
        try {
            if (!map?.unproject) throw new Error('Invalid MapLibre map instance');
            const lngLat = map.unproject([screenPoint.x, screenPoint.y]);
            return { x: lngLat.lng, y: lngLat.lat, crs: WGS84 };
        } catch (error) {
            console.error('MapLibre screenToMap conversion failed:', error);
            return { x: 0, y: 0, crs: WGS84 };
        }
    }

    createBoundingBox({ mapPoint, buffer, map }: { mapPoint: MapPoint; buffer: number; map: MapLibreMap }): BoundingBox {
        // Use MapLibre's projection for accurate bbox at any latitude
        // Convert map point to screen, apply pixel buffer, convert back
        const screenPoint = this.mapToScreen(mapPoint, map);

        // Calculate corners in screen space, then unproject to geographic
        // SW corner: x - buffer, y + buffer (screen Y is inverted)
        // NE corner: x + buffer, y - buffer
        const sw = map.unproject([screenPoint.x - buffer, screenPoint.y + buffer]);
        const ne = map.unproject([screenPoint.x + buffer, screenPoint.y - buffer]);

        return {
            minX: sw.lng,
            minY: sw.lat,
            maxX: ne.lng,
            maxY: ne.lat,
        };
    }

    toJSON(point: MapPoint | null): any {
        return point ? { x: point.x, y: point.y, crs: point.crs } : null;
    }

    mapToScreen(mapPoint: MapPoint, map: MapLibreMap): ScreenPoint {
        try {
            if (!map?.project) throw new Error('Invalid MapLibre map instance');
            const screenCoords = map.project([mapPoint.x, mapPoint.y]);
            return { x: screenCoords.x, y: screenCoords.y };
        } catch (error) {
            console.error('MapLibre mapToScreen conversion failed:', error);
            return { x: 0, y: 0 };
        }
    }

    getViewBounds(map: MapLibreMap): BoundingBox {
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

    getResolution(map: MapLibreMap): number {
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
