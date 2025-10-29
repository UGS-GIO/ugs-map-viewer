import type { CoordinateAdapter, ScreenPoint, MapPoint, BoundingBox } from './types';

/** ArcGIS coordinate transformation using MapView/SceneView */
export class ArcGISCoordinateAdapter implements CoordinateAdapter {
    screenToMap(screenPoint: ScreenPoint, view: __esri.MapView | __esri.SceneView): MapPoint {
        const arcgisPoint = view.toMap(screenPoint);
        if (!arcgisPoint) {
            return { x: 0, y: 0, spatialReference: { wkid: 3857 } };
        }
        return {
            x: arcgisPoint.x,
            y: arcgisPoint.y,
            spatialReference: { wkid: arcgisPoint.spatialReference?.wkid || 3857 }
        };
    }

    createBoundingBox({ mapPoint, resolution, buffer }: { mapPoint: MapPoint; resolution: number; buffer: number }): BoundingBox {
        const halfSize = (buffer * resolution) / 2;
        return {
            minX: mapPoint.x - halfSize,
            minY: mapPoint.y - halfSize,
            maxX: mapPoint.x + halfSize,
            maxY: mapPoint.y + halfSize,
        };
    }

    toJSON(point: MapPoint | null): any {
        return point ? { x: point.x, y: point.y, spatialReference: point.spatialReference } : null;
    }

    mapToScreen(mapPoint: MapPoint, view: __esri.MapView | __esri.SceneView): ScreenPoint {
        try {
            const pointLike = {
                x: mapPoint.x,
                y: mapPoint.y,
                spatialReference: { wkid: mapPoint.spatialReference?.wkid || 3857 }
            };
            const screenCoords = view.toScreen(pointLike as any);
            return screenCoords ? { x: screenCoords.x, y: screenCoords.y } : { x: 0, y: 0 };
        } catch (error) {
            console.error('ArcGIS mapToScreen conversion failed:', error);
            return { x: 0, y: 0 };
        }
    }

    getViewBounds(view: __esri.MapView | __esri.SceneView): BoundingBox {
        const extent = view.extent;
        return extent
            ? { minX: extent.xmin, minY: extent.ymin, maxX: extent.xmax, maxY: extent.ymax }
            : { minX: -180, minY: -90, maxX: 180, maxY: 90 };
    }

    getResolution(view: __esri.MapView | __esri.SceneView): number {
        const resolution = view.resolution;
        return resolution ? resolution / 111320 : 0.0001;
    }
}
