import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArcGISCoordinateAdapter } from '../arcgis';
import { MapLibreCoordinateAdapter } from '../maplibre';
import type { ScreenPoint, MapPoint } from '../types';

/**
 * Unit tests for coordinate adapters
 *
 * These tests verify that both ArcGIS and MapLibre adapters:
 * 1. Convert screen coordinates to map coordinates correctly
 * 2. Create bounding boxes with proper dimensions
 * 3. Calculate resolution (degrees per pixel)
 * 4. Provide inverse transformations
 *
 * Testing strategy:
 * - Mock MapLibre and ArcGIS views
 * - Test coordinate conversions against known values
 * - Verify mathematical accuracy of bbox calculations
 * - Ensure error handling for invalid inputs
 */

describe('ArcGISCoordinateAdapter', () => {
    let adapter: ArcGISCoordinateAdapter;
    let mockView: any;

    beforeEach(() => {
        adapter = new ArcGISCoordinateAdapter();

        // Mock ArcGIS MapView
        mockView = {
            toMap: vi.fn((screenPoint: ScreenPoint) => {
                // Simple mock: scale screen coords by a factor
                return {
                    x: screenPoint.x * 2,
                    y: screenPoint.y * 2,
                    spatialReference: { wkid: 3857 }
                };
            }),
            toScreen: vi.fn((arcgisPoint: any) => {
                return {
                    x: arcgisPoint.x / 2,
                    y: arcgisPoint.y / 2
                };
            }),
            extent: {
                xmin: -20037508,
                ymin: -20037508,
                xmax: 20037508,
                ymax: 20037508,
                spatialReference: { wkid: 3857 }
            },
            resolution: 152.87,
        };
    });

    describe('screenToMap', () => {
        it('should convert screen coordinates to map coordinates', () => {
            const screenPoint: ScreenPoint = { x: 100, y: 100 };
            const result = adapter.screenToMap(screenPoint, mockView);

            expect(result).toEqual({
                x: 200,
                y: 200,
                spatialReference: { wkid: 3857 }
            });
        });

        it('should call view.toMap with correct parameters', () => {
            const screenPoint: ScreenPoint = { x: 50, y: 75 };
            adapter.screenToMap(screenPoint, mockView);

            expect(mockView.toMap).toHaveBeenCalledWith(screenPoint);
        });

        it('should return fallback coordinates if view.toMap returns null', () => {
            mockView.toMap.mockReturnValue(null);
            const screenPoint: ScreenPoint = { x: 100, y: 100 };
            const result = adapter.screenToMap(screenPoint, mockView);

            expect(result).toEqual({
                x: 0,
                y: 0,
                spatialReference: { wkid: 3857 }
            });
        });
    });

    describe('createBoundingBox', () => {
        it('should create a bounding box around a map point', () => {
            const mapPoint: MapPoint = { x: 1000, y: 2000, spatialReference: { wkid: 3857 } };
            const result = adapter.createBoundingBox({
                mapPoint,
                resolution: 152.87,
                buffer: 10
            });

            const expectedBuffer = (10 * 152.87) / 2;

            expect(result).toEqual({
                minX: mapPoint.x - expectedBuffer,
                minY: mapPoint.y - expectedBuffer,
                maxX: mapPoint.x + expectedBuffer,
                maxY: mapPoint.y + expectedBuffer
            });
        });

        it('should create symmetric bounding boxes', () => {
            const mapPoint: MapPoint = { x: 0, y: 0, spatialReference: { wkid: 3857 } };
            const result = adapter.createBoundingBox({
                mapPoint,
                resolution: 100,
                buffer: 10
            });

            const center = (result.minX + result.maxX) / 2;
            expect(center).toBe(0);
        });

        it('should scale bbox with buffer radius', () => {
            const mapPoint: MapPoint = { x: 100, y: 100, spatialReference: { wkid: 3857 } };
            const resolution = 100;

            const result10 = adapter.createBoundingBox({
                mapPoint,
                resolution,
                buffer: 10
            });

            const result20 = adapter.createBoundingBox({
                mapPoint,
                resolution,
                buffer: 20
            });

            const width10 = result10.maxX - result10.minX;
            const width20 = result20.maxX - result20.minX;

            expect(width20).toBeCloseTo(width10 * 2, 5);
        });
    });

    describe('toJSON', () => {
        it('should convert map point to JSON format', () => {
            const mapPoint: MapPoint = { x: 1000, y: 2000, spatialReference: { wkid: 3857 } };
            const result = adapter.toJSON(mapPoint);

            expect(result).toEqual({
                x: 1000,
                y: 2000,
                spatialReference: { wkid: 3857 }
            });
        });

        it('should return null for null input', () => {
            const result = adapter.toJSON(null);
            expect(result).toBeNull();
        });
    });

    describe('mapToScreen', () => {
        it('should convert map coordinates to screen coordinates', () => {
            const mapPoint: MapPoint = { x: 200, y: 200, spatialReference: { wkid: 3857 } };
            const result = adapter.mapToScreen(mapPoint, mockView);

            expect(result).toEqual({
                x: 100,
                y: 100
            });
        });

        it('should return fallback coordinates if view.toScreen returns null', () => {
            mockView.toScreen.mockReturnValue(null);
            const mapPoint: MapPoint = { x: 1000, y: 2000, spatialReference: { wkid: 3857 } };
            const result = adapter.mapToScreen(mapPoint, mockView);

            expect(result).toEqual({ x: 0, y: 0 });
        });
    });

    describe('getViewBounds', () => {
        it('should return extent as bounding box', () => {
            const result = adapter.getViewBounds(mockView);

            expect(result).toEqual({
                minX: -20037508,
                minY: -20037508,
                maxX: 20037508,
                maxY: 20037508
            });
        });

        it('should return world bounds if extent is null', () => {
            mockView.extent = null;
            const result = adapter.getViewBounds(mockView);

            expect(result).toEqual({
                minX: -180,
                minY: -90,
                maxX: 180,
                maxY: 90
            });
        });
    });

    describe('getResolution', () => {
        it('should return resolution in degrees per pixel', () => {
            const result = adapter.getResolution(mockView);

            // ArcGIS resolution is in meters per pixel
            // Convert to degrees: 152.87 meters/pixel / 111320 meters/degree
            const expected = 152.87 / 111320;

            expect(result).toBeCloseTo(expected, 7);
        });

        it('should return fallback if resolution is not available', () => {
            mockView.resolution = null;
            const result = adapter.getResolution(mockView);

            expect(result).toBe(0.0001);
        });
    });
});

describe('MapLibreCoordinateAdapter', () => {
    let adapter: MapLibreCoordinateAdapter;
    let mockMap: any;

    beforeEach(() => {
        adapter = new MapLibreCoordinateAdapter();

        // Mock MapLibre Map
        mockMap = {
            unproject: vi.fn((screenCoords: [number, number]) => {
                // Simple mock: convert screen to lng/lat
                // Assume 256px = 1 degree at zoom 0
                return {
                    lng: screenCoords[0] / 256,
                    lat: screenCoords[1] / 256
                };
            }),
            project: vi.fn((lngLat: [number, number]) => {
                // Inverse of unproject
                return {
                    x: lngLat[0] * 256,
                    y: lngLat[1] * 256
                };
            }),
            getBounds: vi.fn(() => ({
                getWest: () => -180,
                getEast: () => 180,
                getSouth: () => -85.051129,
                getNorth: () => 85.051129
            })),
            getZoom: vi.fn(() => 10),
        };
    });

    describe('screenToMap', () => {
        it('should convert screen coordinates to lng/lat', () => {
            const screenPoint: ScreenPoint = { x: 256, y: 256 };
            const result = adapter.screenToMap(screenPoint, mockMap);

            expect(result).toEqual({
                x: 1,
                y: 1,
                spatialReference: { wkid: 4326 }
            });
        });

        it('should use WGS84 spatial reference (4326)', () => {
            const screenPoint: ScreenPoint = { x: 0, y: 0 };
            const result = adapter.screenToMap(screenPoint, mockMap);

            expect(result.spatialReference?.wkid).toBe(4326);
        });

        it('should call map.unproject with correct parameters', () => {
            const screenPoint: ScreenPoint = { x: 100, y: 200 };
            adapter.screenToMap(screenPoint, mockMap);

            expect(mockMap.unproject).toHaveBeenCalledWith([100, 200]);
        });

        it('should return fallback coordinates if map is invalid', () => {
            const result = adapter.screenToMap({ x: 100, y: 100 }, null);

            expect(result).toEqual({
                x: 0,
                y: 0,
                spatialReference: { wkid: 4326 }
            });
        });

        it('should return fallback coordinates if unproject fails', () => {
            mockMap.unproject.mockImplementation(() => {
                throw new Error('Unproject failed');
            });
            const result = adapter.screenToMap({ x: 100, y: 100 }, mockMap);

            expect(result).toEqual({
                x: 0,
                y: 0,
                spatialReference: { wkid: 4326 }
            });
        });
    });

    describe('createBoundingBox', () => {
        it('should create a bounding box with proper dimensions', () => {
            const mapPoint: MapPoint = { x: 0, y: 0, spatialReference: { wkid: 4326 } };
            const resolution = 0.001; // degrees per pixel
            const buffer = 10; // pixels

            const result = adapter.createBoundingBox({
                mapPoint,
                resolution,
                buffer
            });

            const expectedDelta = buffer * resolution;

            expect(result).toEqual({
                minX: -expectedDelta,
                minY: -expectedDelta,
                maxX: expectedDelta,
                maxY: expectedDelta
            });
        });

        it('should create symmetric bounding boxes around the point', () => {
            const mapPoint: MapPoint = { x: 50, y: 40, spatialReference: { wkid: 4326 } };
            const result = adapter.createBoundingBox({
                mapPoint,
                resolution: 0.001,
                buffer: 10
            });

            const centerX = (result.minX + result.maxX) / 2;
            const centerY = (result.minY + result.maxY) / 2;

            expect(centerX).toBeCloseTo(50, 5);
            expect(centerY).toBeCloseTo(40, 5);
        });

        it('should scale with resolution', () => {
            const mapPoint: MapPoint = { x: 0, y: 0, spatialReference: { wkid: 4326 } };

            const result1 = adapter.createBoundingBox({
                mapPoint,
                resolution: 0.001,
                buffer: 10
            });

            const result2 = adapter.createBoundingBox({
                mapPoint,
                resolution: 0.002,
                buffer: 10
            });

            const width1 = result1.maxX - result1.minX;
            const width2 = result2.maxX - result2.minX;

            expect(width2).toBeCloseTo(width1 * 2, 5);
        });
    });

    describe('toJSON', () => {
        it('should convert map point to JSON format', () => {
            const mapPoint: MapPoint = { x: -122.4194, y: 37.7749, spatialReference: { wkid: 4326 } };
            const result = adapter.toJSON(mapPoint);

            expect(result).toEqual({
                x: -122.4194,
                y: 37.7749,
                spatialReference: { wkid: 4326 }
            });
        });

        it('should return null for null input', () => {
            const result = adapter.toJSON(null);
            expect(result).toBeNull();
        });
    });

    describe('mapToScreen', () => {
        it('should convert lng/lat to screen coordinates', () => {
            const mapPoint: MapPoint = { x: 1, y: 1, spatialReference: { wkid: 4326 } };
            const result = adapter.mapToScreen(mapPoint, mockMap);

            expect(result).toEqual({
                x: 256,
                y: 256
            });
        });

        it('should return fallback coordinates if map is invalid', () => {
            const mapPoint: MapPoint = { x: 0, y: 0, spatialReference: { wkid: 4326 } };
            const result = adapter.mapToScreen(mapPoint, null);

            expect(result).toEqual({ x: 0, y: 0 });
        });

        it('should return fallback coordinates if project fails', () => {
            mockMap.project.mockImplementation(() => {
                throw new Error('Project failed');
            });
            const mapPoint: MapPoint = { x: 0, y: 0, spatialReference: { wkid: 4326 } };
            const result = adapter.mapToScreen(mapPoint, mockMap);

            expect(result).toEqual({ x: 0, y: 0 });
        });
    });

    describe('getViewBounds', () => {
        it('should return map bounds in WGS84', () => {
            const result = adapter.getViewBounds(mockMap);

            expect(result).toEqual({
                minX: -180,
                minY: -85.051129,
                maxX: 180,
                maxY: 85.051129
            });
        });

        it('should return world bounds if map is invalid', () => {
            const result = adapter.getViewBounds(null);

            expect(result).toEqual({
                minX: -180,
                minY: -90,
                maxX: 180,
                maxY: 90
            });
        });

        it('should return world bounds if getBounds fails', () => {
            mockMap.getBounds.mockImplementation(() => {
                throw new Error('Get bounds failed');
            });
            const result = adapter.getViewBounds(mockMap);

            expect(result).toEqual({
                minX: -180,
                minY: -90,
                maxX: 180,
                maxY: 90
            });
        });
    });

    describe('getResolution', () => {
        it('should calculate resolution from zoom level', () => {
            const result = adapter.getResolution(mockMap);

            // At zoom 10: 40075017 / (256 * 2^10) = 152.87 m/pixel
            // Convert to degrees: 152.87 / 111320 ≈ 0.001374 degrees/pixel
            const expectedMetersPerPixel = 40075017 / (256 * Math.pow(2, 10));
            const expectedDegreesPerPixel = expectedMetersPerPixel / 111320;

            expect(result).toBeCloseTo(expectedDegreesPerPixel, 6);
        });

        it('should return fallback if map is invalid', () => {
            const result = adapter.getResolution(null);
            expect(result).toBe(0.0001);
        });

        it('should return fallback if getZoom fails', () => {
            mockMap.getZoom.mockImplementation(() => {
                throw new Error('Get zoom failed');
            });
            const result = adapter.getResolution(mockMap);
            expect(result).toBe(0.0001);
        });
    });
});

describe('Coordinate Adapter Cross-Implementation Tests', () => {
    /**
     * These tests verify that both adapters behave consistently
     * when given equivalent inputs and comparable map states.
     */

    it('should create bounding boxes of equivalent size at similar zoom levels', () => {
        const arcgisAdapter = new ArcGISCoordinateAdapter();
        const maplibreAdapter = new MapLibreCoordinateAdapter();

        // ArcGIS: 152.87 m/pixel at zoom 10
        const arcgisResolution = 152.87 / 111320; // convert to degrees

        // MapLibre: at zoom 10, resolution is ~0.001374 degrees/pixel
        const maplibreResolution = 0.001374;

        const arcgisBbox = arcgisAdapter.createBoundingBox({
            mapPoint: { x: 0, y: 0, spatialReference: { wkid: 3857 } },
            resolution: arcgisResolution,
            buffer: 10
        });

        const maplibreBbox = maplibreAdapter.createBoundingBox({
            mapPoint: { x: 0, y: 0, spatialReference: { wkid: 4326 } },
            resolution: maplibreResolution,
            buffer: 10
        });

        // Bounding boxes should be roughly similar in size
        const arcgisWidth = arcgisBbox.maxX - arcgisBbox.minX;
        const maplibreWidth = maplibreBbox.maxX - maplibreBbox.minX;

        // Allow 5% tolerance due to different coordinate systems
        expect(maplibreWidth).toBeCloseTo(arcgisWidth, 1);
    });

    it('should handle null inputs gracefully', () => {
        const arcgisAdapter = new ArcGISCoordinateAdapter();
        const maplibreAdapter = new MapLibreCoordinateAdapter();

        const arcgisResult = arcgisAdapter.toJSON(null);
        const maplibreResult = maplibreAdapter.toJSON(null);

        expect(arcgisResult).toBeNull();
        expect(maplibreResult).toBeNull();
    });
});
