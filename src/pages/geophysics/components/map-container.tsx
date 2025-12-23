import { MapControls } from '@/pages/geophysics/components/sidebar/map-configurations/map-controls';
import { ResizableMapContainer } from "@/components/custom/map/resizable-map-container";
import { PROD_GEOSERVER_URL } from '@/lib/constants';

export default function MapContainer() {
    return (
        <ResizableMapContainer
            wmsUrl={`${PROD_GEOSERVER_URL}wms`}
            layerConfigKey="layers"
            popupTitle="Geophysical Features"
        >
            <MapControls />
        </ResizableMapContainer>
    );
}