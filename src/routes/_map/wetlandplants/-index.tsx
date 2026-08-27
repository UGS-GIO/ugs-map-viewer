import { useMemo } from 'react'
import type { FilterSpecification } from 'maplibre-gl'
import GenericMapContainer from '@/components/maps/generic-map-container'
import { MapShell } from '@/components/maps/map-shell'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'
import { wetlandSurveySitesTitle } from './-data/layers/layers'

export default function Map() {
    const { contextValue } = useMapContextState();

    // PRIVACY: the warehouse does not yet offset Confidential wetland survey site
    // coordinates (see comment in -data/layers/layers.tsx). Hide those features entirely
    // rather than render their true location until a dataELT fix lands. Do not remove this
    // without confirming the warehouse pipeline now jitters confidential geometries.
    const vectorLayerFilters = useMemo<Record<string, FilterSpecification>>(() => ({
        [wetlandSurveySitesTitle]: ['!=', ['get', 'privacystatus'], 'Confidential'],
    }), []);

    return (
        <MapContext.Provider value={contextValue}>
            <TourAutoStart />
            <MapShell>
                <GenericMapContainer vectorLayerFilters={vectorLayerFilters} />
            </MapShell>
        </MapContext.Provider>
    )
}
