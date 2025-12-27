import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type maplibregl from 'maplibre-gl'

interface MapInstanceContextValue {
  map: maplibregl.Map | undefined
  setMap: (map: maplibregl.Map) => void
}

const MapInstanceContext = createContext<MapInstanceContextValue | undefined>(undefined)

export function MapInstanceProvider({ children }: { children: ReactNode }) {
  const [map, setMapState] = useState<maplibregl.Map | undefined>(undefined)

  const setMap = useCallback((m: maplibregl.Map) => {
    setMapState(m)
  }, [])

  return (
    <MapInstanceContext.Provider value={{ map, setMap }}>
      {children}
    </MapInstanceContext.Provider>
  )
}

/** Access the MapLibre map instance (for footer coordinates, etc.) */
export function useMapInstance() {
  const context = useContext(MapInstanceContext)
  if (context === undefined) {
    throw new Error('useMapInstance must be used within a MapInstanceProvider')
  }
  return context
}
