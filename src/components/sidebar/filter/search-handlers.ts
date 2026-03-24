import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';
import type { MapLibreMap } from '@/lib/types/map-types';
import { zoomToFeature, zoomToFeatures } from '@/lib/map/utils';
import { highlightFeature, highlightFeatureCollection, clearGraphics, type HighlightOptions } from '@/lib/map/highlight-utils';
import type { ExtendedFeature } from '@/components/maps/popups/types';
import type { ExtendedGeometry, SearchSourceConfig } from './search-types';

function determineCRS(
    feature: Feature<ExtendedGeometry, GeoJsonProperties> | null,
    sourceConfig: SearchSourceConfig
): string {
    const geom = feature?.geometry as ExtendedGeometry | undefined;
    const outputCrs = feature?.properties?.['output_crs'];

    if (sourceConfig.type === 'masquerade') return `EPSG:${sourceConfig.outSR ?? 4326}`;
    if (outputCrs && (typeof outputCrs === 'number' || typeof outputCrs === 'string')) return `EPSG:${outputCrs}`;
    if (geom?.crs?.properties?.name) {
        const match = geom.crs.properties.name.match(/EPSG::(\d+)/);
        return match?.[1] ? `EPSG:${match[1]}` : geom.crs.properties.name;
    }
    if (sourceConfig.type === 'postgREST' && sourceConfig.crs) return sourceConfig.crs;
    return "EPSG:4326";
}

function toExtendedFeature(feat: Feature<ExtendedGeometry, GeoJsonProperties>): ExtendedFeature {
    return {
        type: 'Feature',
        geometry: feat.geometry,
        properties: feat.properties || {},
        namespace: (feat as ExtendedFeature)?.namespace || '',
    };
}

function highlightAndZoom(
    features: Feature<ExtendedGeometry, GeoJsonProperties>[],
    sourceConfig: SearchSourceConfig,
    map: MapLibreMap,
    title: string,
    options?: HighlightOptions,
) {
    if (!features.length) return;
    const sourceCRS = determineCRS(features[0], sourceConfig);

    if (features.length === 1) {
        highlightFeature(toExtendedFeature(features[0]), map, sourceCRS, title, options);
    } else {
        highlightFeatureCollection(features, map, sourceCRS, title, options);
    }

    const extended = features.map(toExtendedFeature);
    if (extended.length === 1) {
        zoomToFeature(extended[0], map, sourceCRS);
    } else {
        zoomToFeatures(extended, map, sourceCRS);
    }
}

export const handleSearchSelect = (
    result: Feature<ExtendedGeometry, GeoJsonProperties> | FeatureCollection<ExtendedGeometry, GeoJsonProperties> | null,
    _sourceUrl: string,
    sourceIndex: number,
    searchConfig: SearchSourceConfig[],
    map: MapLibreMap,
) => {
    const sourceConfig = searchConfig[sourceIndex];
    if (!map || !sourceConfig || !result) return;

    clearGraphics(map);
    const features = result.type === 'FeatureCollection' ? result.features : [result];
    highlightAndZoom(features, sourceConfig, map, 'Search Box Highlight');
};

export const handleCollectionSelect = (
    collection: FeatureCollection<ExtendedGeometry, GeoJsonProperties> | null,
    _sourceUrl: string | null,
    sourceIndex: number,
    searchConfig: SearchSourceConfig[],
    map: MapLibreMap,
) => {
    if (!collection?.features?.length || !map) return;

    clearGraphics(map);
    highlightAndZoom(
        collection.features,
        searchConfig[sourceIndex],
        map,
        'Search Box Collection Highlight',
        { outlineWidth: 6, pointSize: 16, outlineColor: [255, 255, 0, 1] },
    );
};
