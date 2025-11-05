import { MapWidgets } from '@/pages/carbonstorage/components/map-widgets';
import { MapContextMenu } from "@/components/custom/map/map-context-menu";
import { PopupDrawer } from "@/components/custom/popups/popup-drawer";
import { useMapContainer } from "@/hooks/use-map-container";
import { useDomainFilters } from "@/hooks/use-domain-filters";
import { PROD_GEOSERVER_URL } from '@/lib/constants';
import { wellWithTopsWMSTitle } from '@/pages/carbonstorage/data/layers/layers';
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';
import { MapSearchParams } from '@/routes/_map';

interface MapContainerProps {
    searchParams: MapSearchParams;
    updateLayerSelection: (layerTitle: string, selected: boolean) => void;
}

// Carbon Storage specific filter configuration
const CCS_FILTER_MAPPING = {
    [wellWithTopsWMSTitle]: {
        layerTitle: wellWithTopsWMSTitle,
        autoSelectLayer: true
    }
};

export default function MapContainer({ searchParams, updateLayerSelection }: MapContainerProps) {
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
        view,
    } = useMapContainer({
        wmsUrl: `${PROD_GEOSERVER_URL}wms`,
        layersConfig: defaultLayersConfig,
    });

    // Use the generalized domain filters hook
    useDomainFilters({
        view,
        filters: searchParams.filters,
        updateLayerSelection,
        filterMapping: CCS_FILTER_MAPPING
    });

    return (
        <>
            <MapContextMenu coordinates={coordinates} hiddenTriggerRef={contextMenuTriggerRef} />
            <div
                className="relative w-full h-full"
                ref={mapRef}
                onContextMenu={e => handleOnContextMenu(e, contextMenuTriggerRef, setCoordinates)}
            >
                <MapWidgets />
            </div>
            <PopupDrawer
                container={popupContainer}
                drawerTriggerRef={drawerTriggerRef}
                popupContent={popupContent}
                popupTitle="CCS Information"
            />
            <div ref={setPopupContainer} />
        </>
    );
}