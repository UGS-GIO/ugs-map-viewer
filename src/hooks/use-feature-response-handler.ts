import { useEffect, useRef } from 'react';
import { highlightFeature } from '@/lib/map/highlight-utils';
import { LayerContentProps } from '@/components/custom/popups/popup-content-with-pagination';
import { useMap } from '@/hooks/use-map';

interface UseFeatureResponseHandlerProps {
    isSuccess: boolean;
    featureData: LayerContentProps[];
    drawerTriggerRef: React.RefObject<HTMLButtonElement>;
    clickId?: number | null; // Allow null from initial state
    isPolygonQuery?: boolean; // Whether this is a polygon multi-select query
}

/**
 * Custom hook to handle side effects based on feature query responses.
 * Highlights features on the map and manages the visibility of a drawer
 * based on whether features are found.
 * For point queries: highlights the first feature
 * For polygon queries: highlights all features
 * @param isSuccess - Indicates if the feature query was successful.
 * @param featureData - The data returned from the feature query.
 * @param drawerTriggerRef - Ref to the button that toggles the drawer visibility.
 * @param clickId - Unique identifier for each map click to prevent filter changes from closing drawer.
 * @param isPolygonQuery - Whether this is a polygon multi-select query.
 */
export function useFeatureResponseHandler({
    isSuccess,
    featureData,
    drawerTriggerRef,
    clickId,
    isPolygonQuery = false
}: UseFeatureResponseHandlerProps) {
    const { map } = useMap();
    // Track the last click we processed to avoid re-processing on filter changes
    const lastProcessedClickRef = useRef<number | null | undefined>();

    useEffect(() => {
        // Only process if this is a NEW click (not a filter change)
        if (!isSuccess || clickId === undefined || clickId === null || lastProcessedClickRef.current === clickId) {
            return;
        }

        // Mark this click as processed
        lastProcessedClickRef.current = clickId;

        const popupContent = featureData || [];
        const hasFeatures = popupContent.length > 0;
        const drawerState = drawerTriggerRef.current?.getAttribute('data-state');

        // Handle feature highlighting
        if (hasFeatures && map) {
            if (isPolygonQuery) {
                // Multi-select: highlight ALL features
                let featureCount = 0;
                for (const layer of popupContent) {
                    if (layer.features && layer.features.length > 0) {
                        const title = layer.layerTitle || layer.groupLayerTitle;
                        for (const feature of layer.features) {
                            highlightFeature(feature, map, layer.sourceCRS, title);
                            featureCount++;
                        }
                    }
                }
                console.log(`[FeatureResponseHandler] Highlighted ${featureCount} features for multi-select`);
            } else {
                // Point query: highlight only first feature
                const firstLayer = popupContent[0];
                const firstFeature = firstLayer?.features[0];
                if (firstFeature && firstLayer) {
                    const title = firstLayer.layerTitle || firstLayer.groupLayerTitle;
                    highlightFeature(firstFeature, map, firstLayer.sourceCRS, title);
                }
            }
        }

        // Handle drawer visibility - only for NEW clicks
        if (!hasFeatures && drawerState === 'open') {
            // Close drawer if no features found on this click
            drawerTriggerRef.current?.click();
        } else if (hasFeatures && drawerState !== 'open') {
            // Open drawer if features found on this click
            drawerTriggerRef.current?.click();
        }
        // If drawer is already open and we have features, leave it open (don't re-click)
    }, [isSuccess, featureData, map, drawerTriggerRef, clickId]);
}