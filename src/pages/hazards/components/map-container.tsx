import { MapControls } from '@/pages/hazards/components/map-controls';
import { MapContextMenu } from "@/components/custom/map/map-context-menu";
import { PopupDrawer } from "@/components/custom/popups/popup-drawer";
import { useMapContainer } from "@/hooks/use-map-container";
import { PROD_GEOSERVER_URL } from '@/lib/constants';
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';

export default function MapContainer() {
    const defaultLayersConfig = useGetLayerConfigsData('layers');

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
    } = useMapContainer({
        wmsUrl: `${PROD_GEOSERVER_URL}wms`,
        layersConfig: defaultLayersConfig
    });

    return (
        <>
            <MapContextMenu coordinates={coordinates} hiddenTriggerRef={contextMenuTriggerRef} />
            <div
                className="relative w-full h-full"
                ref={mapRef}
                onContextMenu={e => handleOnContextMenu(e, contextMenuTriggerRef, setCoordinates)}
            >
                <MapControls />
            </div>
            <PopupDrawer
                container={popupContainer}
                drawerTriggerRef={drawerTriggerRef}
                popupContent={popupContent}
                popupTitle="Hazards in your area"
                onClose={onDrawerClose}
            />
            <div ref={setPopupContainer} />
        </>
    );
}
