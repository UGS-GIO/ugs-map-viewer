import { MapControls } from '@/pages/wetlandplants/components/map-controls';
import { BaseMapContainer } from "@/components/custom/map/base-map-container";
import { PROD_GEOSERVER_URL } from '@/lib/constants';

export default function MapContainer() {
    return (
        <BaseMapContainer
            wmsUrl={`${PROD_GEOSERVER_URL}wms`}
            layerConfigKey="layers"
            popupTitle="Wetland Plants"
        >
            <MapControls />
        </BaseMapContainer>
    );
}