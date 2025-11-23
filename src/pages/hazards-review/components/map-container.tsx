import { MapControls } from '@/pages/hazards-review/components/map-controls';
import { MapContextMenu } from "@/components/custom/map/map-context-menu";
import { MapWrapper } from "@/components/custom/map/map-wrapper";
import { PopupDrawer } from "@/components/custom/popups/popup-drawer";
import { useMapContainer } from "@/hooks/use-map-container";
import { PROD_GEOSERVER_URL } from '@/lib/constants';
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';
import MapLoadingSpinner from '@/components/custom/map/map-loading-spinner';
import { z } from 'zod';
import { HazardsReviewSearchParamsSchema } from '@/routes/_map/hazards-review/route';


export type HazardsReviewSearchParams = z.infer<typeof HazardsReviewSearchParamsSchema>;



interface MapContainerProps {
    searchParams?: HazardsReviewSearchParams;
    updateLayerSelection?: (layerTitle: string, selected: boolean) => void;
}

export default function MapContainer(_props: MapContainerProps) {
    const layersConfig = useGetLayerConfigsData();

    const {
        mapRef,
        contextMenuTriggerRef,
        drawerTriggerRef,
        popupContainer,
        setPopupContainer,
        popupContent,
        handleOnContextMenu,
        coordinates,
        setCoordinates,
        isQueryLoading,
    } = useMapContainer({
        wmsUrl: `${PROD_GEOSERVER_URL}wms`,
        layersConfig: layersConfig
    });

    return (
        <>
            <MapContextMenu coordinates={coordinates} hiddenTriggerRef={contextMenuTriggerRef} />
            <MapWrapper
                mapRef={mapRef}
                isLoading={isQueryLoading}
                onContextMenu={e => handleOnContextMenu(e, contextMenuTriggerRef, setCoordinates)}
            >
                <MapControls />
                <MapLoadingSpinner />
            </MapWrapper>
            <PopupDrawer
                container={popupContainer}
                drawerTriggerRef={drawerTriggerRef}
                popupContent={popupContent}
                popupTitle="Hazards in your area"
            />
            <div ref={setPopupContainer} />
        </>
    );
}