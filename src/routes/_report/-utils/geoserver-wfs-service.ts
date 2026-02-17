import type { FeatureCollection, Geometry } from 'geojson';
import { PROD_GEOSERVER_URL } from '@/lib/constants';
import { hazardLayerNameMap, getGeometryField, getLayerCRS } from '../-data/hazard-unit-map';
import { convertCoordinate } from '@/lib/map/conversion-utils';

/**
 * GeoServer WFS response types
 * Hazard unit properties returned by GeoServer WFS queries
 */
type WFSProperties = Record<string, string | number | boolean | null>;

/** Complete WFS FeatureCollection response */
type WFSResponse = FeatureCollection<Geometry, WFSProperties>;

/**
 * Convert polygon JSON to WKT format in the specified CRS
 * @param polygonString - Polygon JSON string
 * @param targetCRS - Target CRS (defaults to EPSG:26912)
 * @returns WKT polygon string in target CRS
 */
function convertPolygonToWKT(polygonString: string, targetCRS: string = 'EPSG:26912'): string {
    try {
        const polygon = JSON.parse(polygonString);

        // Handle polygon format: { rings: [[[x, y], ...]], crs: "EPSG:..." }
        if (polygon.rings && Array.isArray(polygon.rings[0])) {
            const coords = polygon.rings[0];
            const sourceCRS = polygon.crs || 'EPSG:4326'; // Default to WGS84

            let wgs84Coords = coords;

            // Convert to WGS84 first if needed
            if (sourceCRS !== 'EPSG:4326') {
                wgs84Coords = coords.map(([x, y]: number[]) => {
                    return convertCoordinate([x, y], sourceCRS, 'EPSG:4326');
                });
            }

            // Now convert WGS84 to target CRS
            const targetCoords = wgs84Coords.map(([lng, lat]: number[]) => {
                return convertCoordinate([lng, lat], 'EPSG:4326', targetCRS);
            });

            // Create WKT POLYGON in target coordinates
            const wktCoords = targetCoords.map(([x, y]: number[]) => `${x} ${y}`).join(', ');
            return `POLYGON((${wktCoords}))`;
        }

        throw new Error('Unrecognized polygon format');
    } catch (e) {
        console.error('Error converting polygon to WKT:', e);
        throw e;
    }
}

/**
 * Get the hazard unit field name for a layer
 * GeoServer uses lowercase field names like "sfrhazardunit"
 */
function getHazardUnitField(hazardCode: string): string {
    return `${hazardCode.toLowerCase()}hazardunit`;
}

/**
 * Query a single GeoServer layer for hazard units that intersect the polygon
 */
async function queryLayerForUnits(
    layerName: string,
    hazardCode: string,
    polygon: string
): Promise<string[]> {
    const hazardUnitField = getHazardUnitField(hazardCode);
    const geometryField = getGeometryField(hazardCode);
    const layerCRS = getLayerCRS(hazardCode);
    const polygonWKT = convertPolygonToWKT(polygon, layerCRS);

    const params = new URLSearchParams({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeName: layerName,
        outputFormat: 'application/json',
        propertyName: hazardUnitField,
        srsName: layerCRS,
        CQL_FILTER: `INTERSECTS(${geometryField}, ${polygonWKT})`
    });

    const url = `${PROD_GEOSERVER_URL}/wfs?${params.toString()}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`WFS query failed for ${layerName}:`, response.status);
            return [];
        }

        const data: WFSResponse = await response.json();

        const units = data.features
            .map(f => f.properties[hazardUnitField])
            .filter((unit): unit is string => typeof unit === 'string' && unit !== '');

        return Array.from(new Set(units));

    } catch (error) {
        console.error(`Error querying ${layerName}:`, error);
        return [];
    }
}

/**
 * Generic WFS feature query - fetch raw features from a layer with custom CQL filter
 * @param layerName - Full layer name (e.g., "hazards:qfaults_current")
 * @param polygonWKT - WKT polygon string (must be in the same CRS as specified)
 * @param propertyNames - Comma-separated property names to fetch (optional - fetches all if not specified)
 * @param cqlFilterAddition - Additional CQL filter conditions (optional)
 * @param geometryField - Geometry field name (defaults to 'shape')
 * @param crs - Coordinate reference system (defaults to 'EPSG:26912')
 * @returns Array of features with their properties
 */
export async function queryWFSFeatures<T extends WFSProperties = WFSProperties>(
    layerName: string,
    polygonWKT: string,
    propertyNames?: string,
    cqlFilterAddition?: string,
    geometryField: string = 'shape',
    crs: string = 'EPSG:26912'
): Promise<Array<{ properties: T; geometry: Geometry }>> {
    const baseCQLFilter = `INTERSECTS(${geometryField}, ${polygonWKT})`;
    const cqlFilter = cqlFilterAddition
        ? `${baseCQLFilter} AND ${cqlFilterAddition}`
        : baseCQLFilter;

    const params = new URLSearchParams({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeName: layerName,
        outputFormat: 'application/json',
        srsName: crs,
        CQL_FILTER: cqlFilter
    });

    if (propertyNames) {
        params.set('propertyName', propertyNames);
    }

    const url = `${PROD_GEOSERVER_URL}/wfs?${params.toString()}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`WFS query failed for ${layerName}:`, response.status);
            return [];
        }

        const data: WFSResponse = await response.json();
        return data.features.map(f => ({
            properties: f.properties as T,
            geometry: f.geometry
        }));

    } catch (error) {
        console.error(`Error querying ${layerName}:`, error);
        return [];
    }
}

/**
 * Query all GeoServer hazard layers for units that intersect the polygon
 */
export async function queryGeoServerForHazardUnits(polygon: string) {
    const hazardEntries = Object.entries(hazardLayerNameMap);

    const results = await Promise.all(
        hazardEntries.map(async ([hazardCode, layerName]) => {
            const units = await queryLayerForUnits(layerName, hazardCode, polygon);

            return {
                units,
                hazard: hazardCode,
                url: layerName
            };
        })
    );

    return results.filter(result => result.units.length > 0);
}

/**
 * Convert polygon string to WKT (exported for external use)
 * @param polygonString - Polygon JSON string
 * @param targetCRS - Target CRS (defaults to EPSG:26912)
 */
export function convertPolygonStringToWKT(polygonString: string, targetCRS: string = 'EPSG:26912'): string {
    return convertPolygonToWKT(polygonString, targetCRS);
}