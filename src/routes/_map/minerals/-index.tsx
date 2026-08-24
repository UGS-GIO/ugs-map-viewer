import GenericMapContainer from '@/components/maps/generic-map-container'
import { MapShell } from '@/components/maps/map-shell'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'

export default function Map() {
    const { contextValue } = useMapContextState();

    return (
        <MapContext.Provider value={contextValue}>
            <TourAutoStart />
            <MapShell>
        <GenericMapContainer />
      </MapShell>
    </MapContext.Provider>
    )
}
