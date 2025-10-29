export interface MapPoint {
    x: number;
    y: number;
    spatialReference?: { wkid: number };
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

/** Coordinate transformation interface for ArcGIS or MapLibre */
export interface CoordinateAdapter {
    screenToMap(screenPoint: ScreenPoint, view: any): MapPoint;
    mapToScreen(mapPoint: MapPoint, view: any): ScreenPoint;
    createBoundingBox(params: { mapPoint: MapPoint; resolution: number; buffer: number }): BoundingBox;
    toJSON(point: MapPoint | null): any;
    getViewBounds(view: any): BoundingBox;
    getResolution(view: any): number;
}
