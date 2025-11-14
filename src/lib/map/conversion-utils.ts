import { coordEach } from "@turf/meta";
import { clone } from "@turf/clone";
import { Geometry, Position } from "geojson";
import proj4 from "proj4";

export function convertDDToDMS(dd: number, isLongitude: boolean = false) {
    const dir = dd < 0
        ? isLongitude ? 'W' : 'S'
        : isLongitude ? 'E' : 'N';

    const absDd = Math.abs(dd);
    const degrees = Math.floor(absDd);
    const minutes = Math.floor((absDd - degrees) * 60);
    const seconds = Math.round(((absDd - degrees) * 60 - minutes) * 60);

    // Pad degrees, minutes, and seconds with leading zeros if they're less than 10
    const degreesStr = degrees.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    const secondsStr = seconds.toString().padStart(2, '0');

    return `${degreesStr}° ${minutesStr}' ${secondsStr}" ${dir}`;
}


export const convertCoordinate = (point: number[], sourceEPSG: string, targetEPSG: string = "EPSG:4326"): number[] => {
    try {
        const converted = proj4(
            sourceEPSG,
            targetEPSG,
            point
        );

        return converted;
    } catch (error) {
        console.error('Coordinate conversion error:', error);
        return point; // fallback to original point
    }
};

export const convertBbox = (bbox: number[], sourceEPSG: string, targetEPSG: string = "EPSG:4326"): number[] => {

    try {
        // Check if bbox values are already in degrees (EPSG:4326)
        // WMS GetFeatureInfo always returns bbox in EPSG:4326 regardless of requested CRS
        const isAlreadyDegrees = Math.abs(bbox[0]) <= 180 && Math.abs(bbox[1]) <= 90 &&
                                  Math.abs(bbox[2]) <= 180 && Math.abs(bbox[3]) <= 90;

        if (isAlreadyDegrees && (sourceEPSG === "EPSG:3857" || sourceEPSG === "EPSG:26912")) {
            // Bbox is already in EPSG:4326, just return it
            return bbox;
        }

        // Convert all four corners of the bbox to handle projection distortions
        const sw = convertCoordinate([bbox[0], bbox[1]], sourceEPSG, targetEPSG); // southwest
        const se = convertCoordinate([bbox[2], bbox[1]], sourceEPSG, targetEPSG); // southeast
        const nw = convertCoordinate([bbox[0], bbox[3]], sourceEPSG, targetEPSG); // northwest
        const ne = convertCoordinate([bbox[2], bbox[3]], sourceEPSG, targetEPSG); // northeast

        // Find actual min/max after projection (coordinates may flip)
        const allX = [sw[0], se[0], nw[0], ne[0]];
        const allY = [sw[1], se[1], nw[1], ne[1]];

        const minX = Math.min(...allX);
        const minY = Math.min(...allY);
        const maxX = Math.max(...allX);
        const maxY = Math.max(...allY);

        // Return in [minX, minY, maxX, maxY] format for target coordinate system
        return [minX, minY, maxX, maxY];
    } catch (error) {
        console.error('Bbox conversion error:', error);
        return bbox; // fallback to original bbox
    }
};

export const convertCoordinates = (coordinates: number[][][], sourceCRS: string): number[][] => {
    return coordinates.flatMap(linestring =>
        linestring.map(point => {
            try {
                const converted = proj4(sourceCRS, "EPSG:4326", point);
                return converted;
            } catch (error) {
                console.error('Conversion error:', error);
                return point; // fallback
            }
        })
    );
};

export const extractCoordinates = (geometry: Geometry): number[][][] => {
    switch (geometry.type) {
        case 'Point':
            return [[geometry.coordinates as number[]]];
        case 'LineString':
            return [geometry.coordinates as number[][]];
        case 'MultiLineString':
            return geometry.coordinates as number[][][];
        case 'Polygon':
            return geometry.coordinates;
        case 'MultiPolygon':
            return geometry.coordinates.flatMap(polygon => polygon);
        default:
            console.warn('Unsupported geometry type', geometry.type);
            return [];
    }
};


/**
 * Converts a GeoJSON geometry object from a source CRS to WGS84 (EPSG:4326).
 * This is the single source of truth for all coordinate conversions.
 */
// --- Reproject GeoJSON Geometry to WGS84 ---
export function convertGeometryToWGS84<G extends Geometry>(
    geometry: G | null | undefined,
    sourceCRS: string
): G | null {
    if (!geometry) {
        console.warn("convertGeometryToWGS84: Input geometry is null or undefined.");
        return null;
    }

    const targetCRS = "EPSG:4326";

    if (sourceCRS.toUpperCase() === targetCRS || sourceCRS.toUpperCase() === 'WGS84' || sourceCRS.toUpperCase() === '4326') {
        try {
            return clone(geometry) as G;
        } catch (cloneError: any) {
            console.error("Error cloning geometry:", cloneError);
            return null;
        }
    }

    let clonedGeometry: G;
    try {
        clonedGeometry = clone(geometry);
    } catch (setupError: any) {
        console.error(`Error during geometry conversion setup for ${sourceCRS}:`, setupError);
        return null;
    }

    let conversionErrorFound: Error | null = null;
    coordEach(clonedGeometry, (currentCoord, coordIndex) => {
        if (conversionErrorFound) return;
        if (Array.isArray(currentCoord) && currentCoord.length >= 2) {
            const originalCoord: Position = [currentCoord[0], currentCoord[1]];
            try {
                const convertedCoord = proj4(sourceCRS, targetCRS, originalCoord);
                currentCoord[0] = convertedCoord[0];
                currentCoord[1] = convertedCoord[1];

            } catch (projError: any) {
                const errorMsg = `Coordinate conversion failed for ${JSON.stringify(originalCoord)} from ${sourceCRS}: ${projError?.message || projError}`;
                console.error(errorMsg);
                conversionErrorFound = new Error(errorMsg);
            }
        } else {
            const errorMsg = `Invalid coordinate structure encountered at index ${coordIndex}: ${JSON.stringify(currentCoord)}`;
            console.error(errorMsg);
            conversionErrorFound = new Error(errorMsg);
        }
    });

    if (conversionErrorFound) {
        console.error("Conversion failed:", conversionErrorFound);
        return null;
    }
    return clonedGeometry;
}

/**
 * Convert ArcGIS Polygon rings to WGS84 (EPSG:4326)
 * Handles multiple EPSG codes including Web Mercator variants
 */
export function convertArcGISPolygonToWGS84(polygon: string): number[][] | null {
    try {
        const parsed = JSON.parse(polygon);

        if (!parsed.rings || !Array.isArray(parsed.rings[0])) {
            return null;
        }

        const coords = parsed.rings[0];
        const wkid = parsed.spatialReference?.wkid || parsed.spatialReference?.latestWkid;

        // If already in WGS84, return as-is
        if (!wkid || wkid === 4326) {
            return coords;
        }

        // Map ArcGIS WKIDs to EPSG codes
        let sourceCRS = `EPSG:${wkid}`;
        if (wkid === 102100 || wkid === 102113) {
            sourceCRS = 'EPSG:3857'; // Web Mercator
        }

        // Use standard conversion utility for all coordinate systems
        return coords.map(([x, y]: number[]) => {
            const converted = convertCoordinate([x, y], sourceCRS, 'EPSG:4326');
            return converted;
        });
    } catch (e) {
        console.error('Error converting polygon:', e);
        return null;
    }
}

/**
 * Calculate bounding box from coordinates
 * Returns [[minLng, minLat], [maxLng, maxLat]] format
 */
export function calculateBounds(coordinates: number[][]): [[number, number], [number, number]] | null {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
        return null;
    }

    const lngs = coordinates.map(coord => coord[0]).filter(v => typeof v === 'number');
    const lats = coordinates.map(coord => coord[1]).filter(v => typeof v === 'number');

    if (lngs.length === 0 || lats.length === 0) {
        return null;
    }

    return [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
    ];
}

/**
 * Calculate zoom level from bounds
 * Used for MapLibre map sizing
 */
export function calculateZoomFromBounds(bounds: [[number, number], [number, number]] | null): number {
    if (!bounds) return 10;
    const [[minLng, minLat], [maxLng, maxLat]] = bounds;
    const lngDiff = maxLng - minLng;
    const latDiff = maxLat - minLat;
    const maxDiff = Math.max(lngDiff, latDiff);

    if (maxDiff > 1) return 7;
    else if (maxDiff > 0.5) return 8;
    else if (maxDiff > 0.2) return 9;
    else if (maxDiff > 0.1) return 10;
    else if (maxDiff > 0.05) return 11;
    else if (maxDiff > 0.02) return 12;
    else return 13;
}
