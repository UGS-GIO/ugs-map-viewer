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
 * Reduce coordinate precision to reduce URL size
 * Rounds to 6 decimal places (~0.1 meter precision for WGS84)
 */
export function reduceCoordinatePrecision(coordinates: number[][], decimals: number = 6): number[][] {
    const factor = Math.pow(10, decimals);
    return coordinates.map(([lng, lat]) => [
        Math.round(lng * factor) / factor,
        Math.round(lat * factor) / factor
    ]);
}

/**
 * Serialize polygon for URL query parameter
 * Converts coordinates to WGS84 (EPSG:4326) for human-readable URLs
 * Reduces precision and strips unnecessary ArcGIS object structure
 * Returns compact JSON string suitable for URL encoding
 *
 * Format: { "rings": [[[lng, lat], [lng, lat], ...]] }
 * - rings: Array of coordinate rings in [longitude, latitude] order (MapLibre/GeoJSON standard)
 * - Always serialized in WGS84 for readability (coordinates like [-111.8, 40.76] instead of [-12467174, 4973828])
 *
 * Example URL: /hazards/report?aoi=%7B%22rings%22%3A%5B%5B%5B-111.8%2C40.76%5D...%5D%5D%7D
 */
export function serializePolygonForUrl(polygon: __esri.Geometry | null): string | null {
    if (!polygon) return null;

    try {
        // Type check - ensure it's a polygon with rings
        if (!('rings' in polygon)) {
            console.error('Invalid geometry type for serialization');
            return null;
        }

        const rings = (polygon as any).rings ?? [];
        const wkid = (polygon as any).spatialReference?.wkid || 102100;

        // Convert to WGS84 if needed for human-readable coordinates in URL
        let wgs84Rings = rings;
        if (wkid !== 4326) {
            const sourceCRS = wkid === 102100 || wkid === 102113 ? 'EPSG:3857' : `EPSG:${wkid}`;
            wgs84Rings = rings.map((ring: number[][]) =>
                ring.map(([x, y]: number[]) => {
                    const [lng, lat] = convertCoordinate([x, y], sourceCRS, 'EPSG:4326');
                    return [lng, lat];
                })
            );
        }

        // Reduce coordinate precision to 6 decimals (~0.1m precision for lat/lon)
        const reducedRings = wgs84Rings.map((ring: number[][]) => reduceCoordinatePrecision(ring));

        // Compact structure: only rings needed since we always serialize to WGS84
        const compact = {
            rings: reducedRings // rings: [[[lng, lat], [lng, lat], ...]] in WGS84
        };

        return JSON.stringify(compact);
    } catch (error) {
        console.error('Error serializing polygon:', error);
        return null;
    }
}

/**
 * Deserialize polygon from URL query parameter (returns plain object)
 * Used by report routes that don't need ArcGIS Polygon class
 * Reconstructs polygon from compact WGS84 format
 * Converts coordinates back to Web Mercator (EPSG:3857)
 * Expects format: { "rings": [[[lng, lat], [lng, lat], ...]] }
 * - Coordinates are in WGS84 [longitude, latitude] order (human-readable)
 * - Returns plain JS object in Web Mercator (EPSG:3857) with WKID 102100
 */
export function deserializePolygonFromUrl(serialized: string): { rings: number[][][]; spatialReference: { wkid: number } } | null {
    try {
        // Decode URL-encoded parameter first
        const decoded = decodeURIComponent(serialized);
        const compact = JSON.parse(decoded);
        if (!compact.rings || !Array.isArray(compact.rings)) {
            console.warn('Invalid rings in deserialized polygon');
            return null;
        }

        // Convert from WGS84 back to Web Mercator
        const webMercatorRings = compact.rings.map((ring: number[][]) =>
            ring.map(([lng, lat]: number[]) => {
                const [x, y] = convertCoordinate([lng, lat], 'EPSG:4326', 'EPSG:3857');
                return [x, y];
            })
        );

        // Return plain polygon object (not ArcGIS Polygon class instance)
        return {
            rings: webMercatorRings, // rings: [[[x, y], [x, y], ...]] in Web Mercator
            spatialReference: {
                wkid: 102100 // Web Mercator (EPSG:3857)
            }
        };
    } catch (error) {
        console.error('Error deserializing polygon:', error);
        return null;
    }
}

