import { useCallback, useRef } from 'react';
import type { MapLibreMap } from '@/lib/types/map-types';
import proj4 from 'proj4';

const QUERY_BBOX_SOURCE_ID = 'query-bbox-debug';
const QUERY_BBOX_LAYER_ID = 'query-bbox-debug-layer';

export function useQueryBboxVisualizer(map: MapLibreMap | null) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showQueryBbox = useCallback((bbox: { minX: number; minY: number; maxX: number; maxY: number }, crs: string) => {
        if (!map) return;

        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Convert bbox corners to WGS84 for MapLibre display
        let corners;
        if (crs === 'EPSG:4326') {
            corners = [
                [bbox.minX, bbox.minY],
                [bbox.maxX, bbox.minY],
                [bbox.maxX, bbox.maxY],
                [bbox.minX, bbox.maxY],
                [bbox.minX, bbox.minY]
            ];
        } else {
            // Transform each corner from source CRS to WGS84
            const sw = proj4(crs, 'EPSG:4326', [bbox.minX, bbox.minY]);
            const se = proj4(crs, 'EPSG:4326', [bbox.maxX, bbox.minY]);
            const ne = proj4(crs, 'EPSG:4326', [bbox.maxX, bbox.maxY]);
            const nw = proj4(crs, 'EPSG:4326', [bbox.minX, bbox.maxY]);
            corners = [sw, se, ne, nw, sw];
        }

        const bboxPolygon = {
            type: 'Feature' as const,
            properties: {},
            geometry: {
                type: 'Polygon' as const,
                coordinates: [corners]
            }
        };

        // Remove existing source/layer if present
        if (map.getLayer(QUERY_BBOX_LAYER_ID)) {
            map.removeLayer(QUERY_BBOX_LAYER_ID);
        }
        if (map.getSource(QUERY_BBOX_SOURCE_ID)) {
            map.removeSource(QUERY_BBOX_SOURCE_ID);
        }

        // Add source
        map.addSource(QUERY_BBOX_SOURCE_ID, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: [bboxPolygon]
            }
        });

        // Add layer with bright red outline
        map.addLayer({
            id: QUERY_BBOX_LAYER_ID,
            type: 'line',
            source: QUERY_BBOX_SOURCE_ID,
            paint: {
                'line-color': '#ff0000',
                'line-width': 2,
                'line-opacity': 0.8
            }
        });

        // Auto-remove after 2 seconds
        timeoutRef.current = setTimeout(() => {
            if (map.getLayer(QUERY_BBOX_LAYER_ID)) {
                map.removeLayer(QUERY_BBOX_LAYER_ID);
            }
            if (map.getSource(QUERY_BBOX_SOURCE_ID)) {
                map.removeSource(QUERY_BBOX_SOURCE_ID);
            }
        }, 2000);
    }, [map]);

    const hideQueryBbox = useCallback(() => {
        if (!map) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (map.getLayer(QUERY_BBOX_LAYER_ID)) {
            map.removeLayer(QUERY_BBOX_LAYER_ID);
        }
        if (map.getSource(QUERY_BBOX_SOURCE_ID)) {
            map.removeSource(QUERY_BBOX_SOURCE_ID);
        }
    }, [map]);

    return { showQueryBbox, hideQueryBbox };
}
