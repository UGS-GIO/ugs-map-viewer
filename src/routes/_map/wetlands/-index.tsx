import { useMemo } from 'react'
import GenericMapContainer from '@/components/maps/generic-map-container'
import { MapShell } from '@/components/maps/map-shell'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'
import { useLayerUrl } from '@/context/layer-url-provider'
import { LANDSCAPE_LAYER_TITLES } from './-data/landscape-metrics'
import { useLandscapeChoropleth } from './-hooks/use-landscape-choropleth'

export default function Map() {
    const { contextValue } = useMapContextState();
    const { selectedLayerTitles } = useLayerUrl();

    const activeLandscapeTitle = useMemo(() => {
        return Array.from(selectedLayerTitles).find((title) =>
            (LANDSCAPE_LAYER_TITLES as readonly string[]).includes(title)
        );
    }, [selectedLayerTitles]);

    const { pmtilesStyleOverrides } = useLandscapeChoropleth(activeLandscapeTitle);

    return (
        <MapContext.Provider value={contextValue}>
            <TourAutoStart route="wetlands" />
            <MapShell>
                <GenericMapContainer pmtilesStyleOverrides={pmtilesStyleOverrides} />
            </MapShell>
        </MapContext.Provider>
    )
}
