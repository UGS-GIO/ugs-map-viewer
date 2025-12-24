import { useEffect, useRef } from 'react';
import { highlightFeature, clearGraphics } from '@/lib/map/highlight-utils';
import { LayerContentProps } from '@/components/custom/popups/popup-content-with-pagination';
import { useMap } from '@/hooks/use-map';
import { useMultiSelect } from '@/context/multi-select-context';
import type { PopupDrawerRef } from '@/components/custom/popups/popup-drawer';

interface UseFeatureResponseHandlerProps {
    isSuccess: boolean;
    featureData: LayerContentProps[];
    drawerTriggerRef: React.RefObject<HTMLButtonElement>;
    clickId?: number | null; // Allow null from initial state
    popupDrawerRef?: React.RefObject<PopupDrawerRef>;
}

/**
 * Custom hook to handle side effects based on feature query responses.
 * Highlights ALL features on the map and manages the visibility of a drawer
 * based on whether features are found.
 * @param isSuccess - Indicates if the feature query was successful.
 * @param featureData - The data returned from the feature query.
 * @param drawerTriggerRef - Ref to the button that toggles the drawer visibility.
 * @param clickId - Unique identifier for each map click to prevent filter changes from closing drawer.
 */
export function useFeatureResponseHandler({
    isSuccess,
    featureData,
    drawerTriggerRef,
    clickId,
    popupDrawerRef
}: UseFeatureResponseHandlerProps) {
    const { map } = useMap();
    const { consumeSuppressPopup } = useMultiSelect();
    // Track the last click we processed to avoid re-processing on filter changes
    const lastProcessedClickRef = useRef<number | null | undefined>();

    useEffect(() => {
        // Only process if this is a NEW click (not a filter change)
        if (!isSuccess || clickId === undefined || clickId === null || lastProcessedClickRef.current === clickId) {
            return;
        }

        // Mark this click as processed
        lastProcessedClickRef.current = clickId;

        // Check if popup should be suppressed (shift+click behavior)
        const shouldSuppressPopup = consumeSuppressPopup();

        const popupContent = featureData || [];
        const hasFeatures = popupContent.length > 0;
        const drawerState = drawerTriggerRef.current?.getAttribute('data-state');

        // Handle feature highlighting
        // Always clear ALL graphics first, then re-highlight ALL accumulated features
        // This prevents memory leaks from orphaned graphics layers
        if (map) {
            clearGraphics(map);
        }

        if (hasFeatures && map) {
            // Highlight ALL features across all layers
            for (const layer of popupContent) {
                if (layer.features && layer.features.length > 0) {
                    const title = layer.layerTitle || layer.groupLayerTitle;
                    for (const feature of layer.features) {
                        highlightFeature(feature, map, layer.sourceCRS, title);
                    }
                }
            }
        }

        // Handle drawer visibility - only for NEW clicks
        // Skip opening drawer if popup was suppressed (shift+click)
        if (popupDrawerRef?.current) {
            // Use ref methods if available (simpler and more reliable)
            if (!hasFeatures) {
                // Close drawer if no features found on this click
                popupDrawerRef.current.close();
            } else if (!shouldSuppressPopup) {
                // Open drawer if features found on this click (unless suppressed)
                popupDrawerRef.current.open();
            }
        } else {
            // Fall back to clicking trigger for backward compatibility
            if (!hasFeatures && drawerState === 'open') {
                // Close drawer if no features found on this click
                drawerTriggerRef.current?.click();
            } else if (hasFeatures && drawerState !== 'open' && !shouldSuppressPopup) {
                // Open drawer if features found on this click (unless suppressed)
                drawerTriggerRef.current?.click();
            }
        }
        // If drawer is already open and we have features, leave it open
    }, [isSuccess, featureData, map, drawerTriggerRef, clickId, popupDrawerRef, consumeSuppressPopup]);
}