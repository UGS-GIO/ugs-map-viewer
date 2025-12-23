import { MapControls } from '@/pages/carbonstorage/components/map-controls';
import { ResizableMapContainer } from "@/components/custom/map/resizable-map-container";
import { useDomainFilters } from "@/hooks/use-domain-filters";
import { useMap } from "@/hooks/use-map";
import { PROD_GEOSERVER_URL } from '@/lib/constants';
import { wellWithTopsWMSTitle } from '@/pages/carbonstorage/data/layers/layers';
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

// Component that handles domain filters - renders nothing
function DomainFiltersHandler({ searchParams, updateLayerSelection }: MapContainerProps) {
    const { map } = useMap();

    useDomainFilters({
        map,
        filters: searchParams.filters,
        selectedLayers: searchParams.layers?.selected || [],
        updateLayerSelection,
        filterMapping: CCS_FILTER_MAPPING
    });

    return null;
}

export default function MapContainer({ searchParams, updateLayerSelection }: MapContainerProps) {
    return (
        <ResizableMapContainer
            wmsUrl={`${PROD_GEOSERVER_URL}wms`}
            layerConfigKey="layers"
            popupTitle="CCS Information"
        >
            <MapControls />
            <DomainFiltersHandler
                searchParams={searchParams}
                updateLayerSelection={updateLayerSelection}
            />
        </ResizableMapContainer>
    );
}
