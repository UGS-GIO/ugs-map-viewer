import { useCallback } from 'react';
import { useMap } from '@/hooks/use-map';
import { zoomToFeature, zoomToFeatures, ZoomToFeatureOptions } from '@/lib/map/utils';
import type { ExtendedFeature } from '@/components/maps/popups/types';
import type { HighlightFeature } from '@/components/maps/types';

interface UseZoomToFeatureOptions {
    onHighlightChange?: (features: HighlightFeature[]) => void;
}

export function useZoomToFeature({ onHighlightChange }: UseZoomToFeatureOptions = {}) {
    const { map } = useMap();

    const zoomTo = useCallback((
        feature: ExtendedFeature,
        sourceCRS: string,
        options?: ZoomToFeatureOptions
    ) => {
        if (!map) return;

        if (feature.geometry) {
            onHighlightChange?.([{
                id: feature.id as string | number,
                geometry: feature.geometry,
                properties: feature.properties || {}
            }]);
        }

        zoomToFeature(feature, map, sourceCRS, options);
    }, [map, onHighlightChange]);

    const zoomToAll = useCallback((
        features: ExtendedFeature[],
        sourceCRS: string,
        options?: ZoomToFeatureOptions
    ) => {
        if (!map || features.length === 0) return;

        const highlights = features
            .filter(f => f.geometry)
            .map(f => ({
                id: f.id as string | number,
                geometry: f.geometry!,
                properties: f.properties || {}
            }));
        onHighlightChange?.(highlights);

        zoomToFeatures(features, map, sourceCRS, options);
    }, [map, onHighlightChange]);

    return { zoomTo, zoomToAll, map };
}
