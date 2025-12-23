import { MapControls } from '@/pages/hazards-review/components/map-controls';
import { ResizableMapContainer } from "@/components/custom/map/resizable-map-container";
import { PROD_GEOSERVER_URL } from '@/lib/constants';
import MapLoadingSpinner from '@/components/custom/map/map-loading-spinner';

export default function MapContainer() {
    return (
        <ResizableMapContainer
            wmsUrl={`${PROD_GEOSERVER_URL}wms`}
            layerConfigKey="layers"
            popupTitle="Hazards in your area"
        >
            <MapControls />
            <MapLoadingSpinner />
        </ResizableMapContainer>
    );
}
