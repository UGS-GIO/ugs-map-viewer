import { MapControls } from '@/pages/wetlands/components/map-controls';
import { ResizableMapContainer } from "@/components/custom/map/resizable-map-container";
import { PROD_GEOSERVER_URL } from '@/lib/constants';

export default function MapContainer() {
    return (
        <ResizableMapContainer
            wmsUrl={`${PROD_GEOSERVER_URL}wms`}
            layerConfigKey="layers"
            popupTitle="Wetlands"
        >
            <MapControls />
        </ResizableMapContainer>
    );
}