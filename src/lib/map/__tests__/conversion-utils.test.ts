import { describe, it, expect, vi } from 'vitest';
import {
  convertDDToDMS,
  convertCoordinate,
  convertBbox,
  convertCoordinates,
  extractCoordinates,
  convertGeometryToWGS84
} from '../conversion-utils';
import type { Geometry } from 'geojson';

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

describe('convertCoordinates', () => {
  it('converts array of linestring coordinates', () => {
    const coordinates = [
      [[0, 0], [1, 1], [2, 2]]
    ];
    const result = convertCoordinates(coordinates, 'EPSG:4326');

    expect(result.length).toBe(3);
    expect(result[0]).toEqual([0, 0]);
  });

  it('flattens multiple linestrings', () => {
    const coordinates = [
      [[0, 0], [1, 1]],
      [[2, 2], [3, 3]]
    ];
    const result = convertCoordinates(coordinates, 'EPSG:4326');

    expect(result.length).toBe(4);
  });

  it('handles conversion errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const coordinates = [
      [[0, 0], [1, 1]]
    ];
    const result = convertCoordinates(coordinates, 'INVALID_CRS');

    expect(result.length).toBe(2);
    consoleSpy.mockRestore();
  });
});

describe('extractCoordinates', () => {
  it('extracts coordinates from Point geometry', () => {
    const geometry: Geometry = {
      type: 'Point',
      coordinates: [100, 50]
    };
    const result = extractCoordinates(geometry);

    expect(result).toEqual([[[100, 50]]]);
  });

  it('extracts coordinates from LineString geometry', () => {
    const geometry: Geometry = {
      type: 'LineString',
      coordinates: [[100, 50], [101, 51]]
    };
    const result = extractCoordinates(geometry);

    expect(result).toEqual([[[100, 50], [101, 51]]]);
  });

  it('extracts coordinates from Polygon geometry', () => {
    const geometry: Geometry = {
      type: 'Polygon',
      coordinates: [
        [[100, 50], [101, 50], [101, 51], [100, 51], [100, 50]]
      ]
    };
    const result = extractCoordinates(geometry);

    expect(result.length).toBe(1);
    expect(result[0].length).toBe(5);
  });

  it('extracts coordinates from MultiLineString geometry', () => {
    const geometry: Geometry = {
      type: 'MultiLineString',
      coordinates: [
        [[100, 50], [101, 51]],
        [[102, 52], [103, 53]]
      ]
    };
    const result = extractCoordinates(geometry);

    expect(result.length).toBe(2);
  });

  it('extracts coordinates from MultiPolygon geometry', () => {
    const geometry: Geometry = {
      type: 'MultiPolygon',
      coordinates: [
        [[[100, 50], [101, 50], [101, 51], [100, 51], [100, 50]]],
        [[[102, 52], [103, 52], [103, 53], [102, 53], [102, 52]]]
      ]
    };
    const result = extractCoordinates(geometry);

    expect(result.length).toBe(2);
  });

  it('returns empty array for unsupported geometry types', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const geometry = {
      type: 'GeometryCollection',
      geometries: []
    } as any;
    const result = extractCoordinates(geometry);

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
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
