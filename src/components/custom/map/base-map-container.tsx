import { MapContextMenu } from "@/components/custom/map/map-context-menu";
import { MapWrapper } from "@/components/custom/map/map-wrapper";
import { PopupDrawer } from "@/components/custom/popups/popup-drawer";
import { useMapContainer } from "@/hooks/use-map-container";
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';

interface GenericMapContainerProps {
    wmsUrl: string;
    layerConfigKey: string;
    popupTitle: string;
    children: React.ReactNode;
}

export function BaseMapContainer({ wmsUrl, layerConfigKey, popupTitle, children }: GenericMapContainerProps) {
    const defaultLayersConfig = useGetLayerConfigsData(layerConfigKey);

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
        onDrawerClose,
        isQueryLoading,
    } = useMapContainer({
        wmsUrl,
        layersConfig: defaultLayersConfig
    });

    return (
        <>
            <MapContextMenu coordinates={coordinates} hiddenTriggerRef={contextMenuTriggerRef} />
            <MapWrapper
                mapRef={mapRef}
                isLoading={isQueryLoading}
                onContextMenu={e => handleOnContextMenu(e, contextMenuTriggerRef, setCoordinates)}
            >
                {children}
            </MapWrapper>
            <PopupDrawer
                container={popupContainer}
                drawerTriggerRef={drawerTriggerRef}
                popupContent={popupContent}
                popupTitle={popupTitle}
                onClose={onDrawerClose}
            />
            <div ref={setPopupContainer} />
        </>
    );
}
