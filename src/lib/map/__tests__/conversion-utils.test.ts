import { describe, it, expect, vi } from 'vitest';
import {
  convertDDToDMS,
  convertCoordinate,
  convertBbox,
  convertGeometryToWGS84,
  convertPolygonToWGS84,
  serializePolygonForUrl,
  deserializePolygonFromUrl,
  calculateBounds,
  calculateZoomFromBounds,
  reduceCoordinatePrecision
} from '../conversion-utils';
import type { Geometry } from 'geojson';
import type { PolygonGeometry } from '../conversion-utils';

describe('convertDDToDMS', () => {
  it('converts positive longitude to DMS', () => {
    const result = convertDDToDMS(111.5, true);
    expect(result).toBe('111° 30\' 00" E');
  });

  it('converts negative longitude to DMS', () => {
    const result = convertDDToDMS(-111.5, true);
    expect(result).toBe('111° 30\' 00" W');
  });

  it('converts positive latitude to DMS', () => {
    const result = convertDDToDMS(40.75, false);
    expect(result).toBe('40° 45\' 00" N');
  });

  it('converts negative latitude to DMS', () => {
    const result = convertDDToDMS(-40.75, false);
    expect(result).toBe('40° 45\' 00" S');
  });

  it('pads single digit values with leading zeros', () => {
    const result = convertDDToDMS(5.5, true);
    expect(result).toBe('05° 30\' 00" E');
  });

  it('handles zero degrees', () => {
    const result = convertDDToDMS(0, true);
    expect(result).toBe('00° 00\' 00" E');
  });
});

describe('convertCoordinate', () => {
  it('converts Web Mercator to WGS84', () => {
    const webMercatorX = -12367126.23;
    const webMercatorY = 4871080.45;
    const result = convertCoordinate([webMercatorX, webMercatorY], 'EPSG:3857', 'EPSG:4326');

    expect(result[0]).toBeCloseTo(-111.09, 1);
    expect(result[1]).toBeCloseTo(40.04, 1);
  });

  it('handles same CRS conversion as passthrough', () => {
    const coords = [-111.09, 40.76];
    const result = convertCoordinate(coords, 'EPSG:4326', 'EPSG:4326');

    expect(result[0]).toBeCloseTo(-111.09, 2);
    expect(result[1]).toBeCloseTo(40.76, 2);
  });

  it('returns original coordinates on conversion error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const invalidCoords = [1000, 2000];
    const result = convertCoordinate(invalidCoords, 'INVALID_CRS', 'EPSG:4326');

    expect(result).toEqual(invalidCoords);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles edge case coordinates', () => {
    const result = convertCoordinate([0, 0], 'EPSG:4326', 'EPSG:4326');
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
  });
});

describe('convertBbox', () => {
  it('detects bbox already in EPSG:4326 when source is EPSG:3857', () => {
    const bboxInDegrees = [-110.09, 38.703, -110.09, 38.703];
    const result = convertBbox(bboxInDegrees, 'EPSG:3857', 'EPSG:4326');

    expect(result).toEqual(bboxInDegrees);
  });

  it('detects bbox already in EPSG:4326 from various sources', () => {
    const bboxInDegrees = [-111.5, 40.5, -110.5, 41.5];
    const result = convertBbox(bboxInDegrees, 'EPSG:3857', 'EPSG:4326');

    expect(result).toEqual(bboxInDegrees);
  });

  it('converts all 4 corners from EPSG:3857 to EPSG:4326', () => {
    const webMercatorBbox = [-12299216.1559, 4438918.917, -12138631.2685, 4758403.8466];
    const result = convertBbox(webMercatorBbox, 'EPSG:3857', 'EPSG:4326');

    expect(result[0]).toBeCloseTo(-110.48, 1);
    expect(result[1]).toBeCloseTo(36.99, 1);
    expect(result[2]).toBeCloseTo(-109.04, 1);
    expect(result[3]).toBeCloseTo(39.25, 1);
  });

  it('handles large meter values correctly', () => {
    const largeBbox = [-13000000, 4000000, -12000000, 5000000];
    const result = convertBbox(largeBbox, 'EPSG:3857', 'EPSG:4326');

    expect(result.length).toBe(4);
    expect(result[0]).toBeLessThan(result[2]);
    expect(result[1]).toBeLessThan(result[3]);
    expect(Math.abs(result[0])).toBeLessThan(180);
    expect(Math.abs(result[1])).toBeLessThan(90);
  });

  it('recalculates min/max after projection to handle coordinate flips', () => {
    const bbox = [-12299216, 4438918, -12138631, 4758403];
    const result = convertBbox(bbox, 'EPSG:3857', 'EPSG:4326');

    expect(result[0]).toBeLessThan(result[2]);
    expect(result[1]).toBeLessThan(result[3]);
  });

  it('returns original bbox on conversion error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bbox = [100, 200, 300, 400];
    const result = convertBbox(bbox, 'INVALID_CRS', 'EPSG:4326');

    expect(result).toEqual(bbox);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles bbox at valid degree boundaries', () => {
    const bbox = [-180, -90, 180, 90];
    const result = convertBbox(bbox, 'EPSG:3857', 'EPSG:4326');

    expect(result).toEqual(bbox);
  });

  it('does not detect large meter values as degrees', () => {
    const largeBbox = [1000000, 5000000, 2000000, 6000000];
    const result = convertBbox(largeBbox, 'EPSG:3857', 'EPSG:4326');

    expect(result).not.toEqual(largeBbox);
  });
});

describe('convertGeometryToWGS84', () => {
  it('returns null for null geometry', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = convertGeometryToWGS84(null, 'EPSG:3857');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns null for undefined geometry', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = convertGeometryToWGS84(undefined, 'EPSG:3857');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('clones geometry when source CRS is already WGS84', () => {
    const geometry: Geometry = {
      type: 'Point',
      coordinates: [100, 50]
    };
    const result = convertGeometryToWGS84(geometry, 'EPSG:4326');

    expect(result).not.toBe(geometry);
    expect(result).toEqual(geometry);
  });

  it('clones geometry when source CRS is WGS84 string variant', () => {
    const geometry: Geometry = {
      type: 'Point',
      coordinates: [100, 50]
    };
    const result = convertGeometryToWGS84(geometry, 'WGS84');

    expect(result).toEqual(geometry);
  });

  it('converts Point geometry from EPSG:3857 to WGS84', () => {
    const geometry: Geometry = {
      type: 'Point',
      coordinates: [-12367126.23, 4871080.45]
    };
    const result = convertGeometryToWGS84(geometry, 'EPSG:3857');

    expect(result).not.toBeNull();
    if (result) {
      expect(result.type).toBe('Point');
      const coords = result.coordinates as [number, number];
      expect(coords[0]).toBeCloseTo(-111.09, 1);
      expect(coords[1]).toBeCloseTo(40.04, 1);
    }
  });

  it('converts Polygon geometry coordinates', () => {
    const geometry: Geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [-12400000, 4900000],
          [-12300000, 4900000],
          [-12300000, 5000000],
          [-12400000, 5000000],
          [-12400000, 4900000]
        ]
      ]
    };
    const result = convertGeometryToWGS84(geometry, 'EPSG:3857');

    expect(result).not.toBeNull();
    if (result && result.type === 'Polygon') {
      expect(result.coordinates[0].length).toBe(5);
      const firstCoord = result.coordinates[0][0];
      expect(Math.abs(firstCoord[0])).toBeLessThan(180);
      expect(Math.abs(firstCoord[1])).toBeLessThan(90);
    }
  });

  it('returns null on conversion error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const geometry: Geometry = {
      type: 'Point',
      coordinates: [100, 50]
    };
    const result = convertGeometryToWGS84(geometry, 'INVALID_CRS');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles invalid coordinate structure', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const geometry = {
      type: 'Point',
      coordinates: [100]
    } as any;
    const result = convertGeometryToWGS84(geometry, 'EPSG:3857');

    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });
});

describe('convertPolygonToWGS84', () => {
  it('converts polygon from EPSG:3857 to WGS84', () => {
    const polygon = JSON.stringify({
      rings: [[[-12367126, 4871080], [-12367000, 4871000], [-12367126, 4871080]]],
      crs: 'EPSG:3857'
    });
    const result = convertPolygonToWGS84(polygon);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.length).toBe(3);
      expect(result[0][0]).toBeCloseTo(-111.09, 1);
      expect(result[0][1]).toBeCloseTo(40.04, 1);
    }
  });

  it('returns coordinates as-is when already in EPSG:4326', () => {
    const coords = [[-111.09, 40.76], [-111.08, 40.75], [-111.09, 40.76]];
    const polygon = JSON.stringify({
      rings: [coords],
      crs: 'EPSG:4326'
    });
    const result = convertPolygonToWGS84(polygon);

    expect(result).toEqual(coords);
  });

  it('defaults to EPSG:4326 when crs is missing', () => {
    const coords = [[-111.09, 40.76], [-111.08, 40.75], [-111.09, 40.76]];
    const polygon = JSON.stringify({
      rings: [coords]
    });
    const result = convertPolygonToWGS84(polygon);

    expect(result).toEqual(coords);
  });

  it('returns null for invalid JSON', () => {
    const result = convertPolygonToWGS84('invalid json');
    expect(result).toBeNull();
  });

  it('returns null for missing rings', () => {
    const polygon = JSON.stringify({ crs: 'EPSG:4326' });
    const result = convertPolygonToWGS84(polygon);
    expect(result).toBeNull();
  });
});

describe('serializePolygonForUrl', () => {
  it('serializes polygon from Web Mercator to WGS84', () => {
    const polygon: PolygonGeometry = {
      rings: [[[-12367126, 4871080], [-12367000, 4871000], [-12367126, 4871080]]],
      crs: 'EPSG:3857'
    };
    const result = serializePolygonForUrl(polygon);

    expect(result).not.toBeNull();
    if (result) {
      const parsed = JSON.parse(result);
      expect(parsed.rings).toBeDefined();
      expect(parsed.rings[0][0][0]).toBeCloseTo(-111.09, 1);
      expect(parsed.rings[0][0][1]).toBeCloseTo(40.04, 1);
    }
  });

  it('reduces coordinate precision to 6 decimals', () => {
    const polygon: PolygonGeometry = {
      rings: [[[-111.123456789, 40.987654321]]],
      crs: 'EPSG:4326'
    };
    const result = serializePolygonForUrl(polygon);

    expect(result).not.toBeNull();
    if (result) {
      const parsed = JSON.parse(result);
      expect(parsed.rings[0][0][0]).toBe(-111.123457);
      expect(parsed.rings[0][0][1]).toBe(40.987654);
    }
  });

  it('returns null for null polygon', () => {
    const result = serializePolygonForUrl(null);
    expect(result).toBeNull();
  });

  it('returns null for polygon without rings', () => {
    const polygon = { crs: 'EPSG:4326' } as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = serializePolygonForUrl(polygon);

    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });

  it('defaults to EPSG:3857 when crs is missing', () => {
    const polygon: PolygonGeometry = {
      rings: [[[-12367126, 4871080]]]
    };
    const result = serializePolygonForUrl(polygon);

    expect(result).not.toBeNull();
    if (result) {
      const parsed = JSON.parse(result);
      expect(parsed.rings[0][0][0]).toBeCloseTo(-111.09, 1);
    }
  });
});

describe('deserializePolygonFromUrl', () => {
  it('deserializes WGS84 polygon to Web Mercator', () => {
    const serialized = JSON.stringify({
      rings: [[[-111.09, 40.76], [-111.08, 40.75], [-111.09, 40.76]]]
    });
    const result = deserializePolygonFromUrl(serialized);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.crs).toBe('EPSG:3857');
      expect(result.rings[0][0][0]).toBeCloseTo(-12366482, -1);
      expect(result.rings[0][0][1]).toBeCloseTo(4977006, -1);
    }
  });

  it('handles URL-encoded input', () => {
    const serialized = encodeURIComponent(JSON.stringify({
      rings: [[[-111.09, 40.76]]]
    }));
    const result = deserializePolygonFromUrl(serialized);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.crs).toBe('EPSG:3857');
    }
  });

  it('returns null for invalid JSON', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = deserializePolygonFromUrl('invalid');

    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });

  it('returns null for missing rings', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = deserializePolygonFromUrl(JSON.stringify({}));

    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });
});

describe('calculateBounds', () => {
  it('calculates bounds from coordinates', () => {
    const coords = [[-111.09, 40.76], [-111.08, 40.75], [-111.10, 40.77]];
    const result = calculateBounds(coords);

    expect(result).not.toBeNull();
    if (result) {
      expect(result[0][0]).toBe(-111.10);
      expect(result[0][1]).toBe(40.75);
      expect(result[1][0]).toBe(-111.08);
      expect(result[1][1]).toBe(40.77);
    }
  });

  it('returns null for empty coordinates', () => {
    const result = calculateBounds([]);
    expect(result).toBeNull();
  });

  it('returns null for null coordinates', () => {
    const result = calculateBounds(null as any);
    expect(result).toBeNull();
  });

  it('filters out invalid coordinates', () => {
    const coords = [[-111.09, 40.76], [null, null] as any, [-111.08, 40.75]];
    const result = calculateBounds(coords);

    expect(result).not.toBeNull();
    if (result) {
      expect(result[0][0]).toBe(-111.09);
      expect(result[1][0]).toBe(-111.08);
    }
  });

  it('handles single point', () => {
    const coords = [[-111.09, 40.76]];
    const result = calculateBounds(coords);

    expect(result).not.toBeNull();
    if (result) {
      expect(result[0]).toEqual([-111.09, 40.76]);
      expect(result[1]).toEqual([-111.09, 40.76]);
    }
  });
});

describe('calculateZoomFromBounds', () => {
  it('returns zoom 7 for large bounds', () => {
    const bounds: [[number, number], [number, number]] = [[-112, 40], [-110, 42]];
    const result = calculateZoomFromBounds(bounds);
    expect(result).toBe(7);
  });

  it('returns zoom 11 for medium bounds', () => {
    const bounds: [[number, number], [number, number]] = [[-111.1, 40.7], [-111.0, 40.8]];
    const result = calculateZoomFromBounds(bounds);
    expect(result).toBe(11);
  });

  it('returns zoom 13 for small bounds', () => {
    const bounds: [[number, number], [number, number]] = [[-111.09, 40.76], [-111.08, 40.77]];
    const result = calculateZoomFromBounds(bounds);
    expect(result).toBe(13);
  });

  it('returns default zoom 10 for null bounds', () => {
    const result = calculateZoomFromBounds(null);
    expect(result).toBe(10);
  });
});

describe('reduceCoordinatePrecision', () => {
  it('reduces precision to 6 decimals by default', () => {
    const coords = [[-111.123456789, 40.987654321]];
    const result = reduceCoordinatePrecision(coords);

    expect(result[0][0]).toBe(-111.123457);
    expect(result[0][1]).toBe(40.987654);
  });

  it('reduces precision to specified decimals', () => {
    const coords = [[-111.123456789, 40.987654321]];
    const result = reduceCoordinatePrecision(coords, 2);

    expect(result[0][0]).toBe(-111.12);
    expect(result[0][1]).toBe(40.99);
  });

  it('handles multiple coordinates', () => {
    const coords = [[-111.123456, 40.987654], [-110.234567, 41.876543]];
    const result = reduceCoordinatePrecision(coords, 3);

    expect(result).toHaveLength(2);
    expect(result[0][0]).toBe(-111.123);
    expect(result[1][1]).toBe(41.877);
  });

  it('handles zero decimals', () => {
    const coords = [[-111.7, 40.8]];
    const result = reduceCoordinatePrecision(coords, 0);

    expect(result[0][0]).toBe(-112);
    expect(result[0][1]).toBe(41);
  });
});
