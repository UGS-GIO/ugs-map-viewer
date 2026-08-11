import { useCallback, useMemo, useEffect, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { convertDDToDMS } from '@/lib/map/conversion-utils'
import { Link, Trash2, MapPin, Navigation } from 'lucide-react'

// Half Esri's LOD 0 scale: their world is 256px at zoom 0, MapLibre's is 512px, so zoom z is Esri level z+1.
const ESRI_SCALE_CONSTANT = 295828763.8
const zoomToScale = (zoom: number) => Math.round(ESRI_SCALE_CONSTANT / Math.pow(2, zoom))

export interface ContextMenuCoords {
  lng: number
  lat: number
  screenX: number
  screenY: number
}

// Limited to what the map can't already do. Query/center/zoom at a point live on left-click,
// drag, scroll, and the NavigationControl.
interface MapContextMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  coords: ContextMenuCoords | null
  onClearSelection?: () => void
  onPinLocation?: (coords: { lat: number; lon: number }) => void
  hasSelection?: boolean
  currentZoom?: number
}

export function MapContextMenu({
  open,
  onOpenChange,
  coords,
  onClearSelection,
  onPinLocation,
  hasSelection = false,
  currentZoom = 10,
}: MapContextMenuProps) {
  const { toast } = useToast()
  const triggerRef = useRef<HTMLDivElement>(null)

  // Position the invisible trigger at the click location
  useEffect(() => {
    if (triggerRef.current && coords) {
      triggerRef.current.style.left = `${coords.screenX}px`
      triggerRef.current.style.top = `${coords.screenY}px`
    }
  }, [coords])

  // Format coordinates in different formats
  const formattedCoords = useMemo(() => {
    if (!coords) return null
    const { lng, lat } = coords
    return {
      decimal: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      dms: `${convertDDToDMS(lat, false)}, ${convertDDToDMS(lng, true)}`,
      latLng: { lat, lng },
    }
  }, [coords])

  // Copy coordinates to clipboard
  const handleCopyCoords = useCallback((format: 'decimal' | 'dms') => {
    if (!formattedCoords) return
    const text = format === 'decimal' ? formattedCoords.decimal : formattedCoords.dms
    navigator.clipboard.writeText(text)
    toast({ description: 'Coordinates copied to clipboard' })
    onOpenChange(false)
  }, [formattedCoords, toast, onOpenChange])

  // Copy shareable link with location
  const handleCopyLink = useCallback(() => {
    if (!coords) return
    const url = new URL(window.location.href)
    url.searchParams.set('lat', coords.lat.toFixed(6))
    url.searchParams.set('lon', coords.lng.toFixed(6))
    url.searchParams.set('zoom', String(Math.round(currentZoom * 100) / 100))
    // Add pin marker at the shared location
    url.searchParams.set('popup_lat', coords.lat.toFixed(6))
    url.searchParams.set('popup_lon', coords.lng.toFixed(6))
    // Remove transient selection state from shared link
    for (const key of ['click_bbox', 'feature_bbox', 'features', 'view']) {
      url.searchParams.delete(key)
    }
    navigator.clipboard.writeText(url.toString())
    onPinLocation?.({ lat: coords.lat, lon: coords.lng })
    toast({ description: 'Link copied to clipboard' })
    onOpenChange(false)
  }, [coords, currentZoom, toast, onOpenChange, onPinLocation])

  // Open in external map services
  const handleOpenInMaps = useCallback((service: 'google' | 'osm' | 'ugs') => {
    if (!coords) return
    const { lat, lng } = coords
    const urls = {
      google: `https://www.google.com/maps?q=${lat},${lng}`,
      osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=${Math.round(currentZoom)}`,
      // 2D MapView uses scale, not zoom. Explicit `layers` — the portal only defaults it in 3D.
      ugs: `https://geomap.geology.utah.gov/?lat=${lat}&lng=${lng}&view=map&scale=${zoomToScale(currentZoom)}&layers=100k,reference`,
    }
    window.open(urls[service], '_blank')
    onOpenChange(false)
  }, [coords, currentZoom, onOpenChange])

  const handleClearSelection = useCallback(() => {
    onClearSelection?.()
    onOpenChange(false)
  }, [onClearSelection, onOpenChange])

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {/* Invisible trigger positioned at click location */}
      <div
        ref={triggerRef}
        className="fixed w-0 h-0 pointer-events-none"
        style={{ left: coords?.screenX ?? 0, top: coords?.screenY ?? 0 }}
      />
      <DropdownMenuContent
        className="w-64"
        style={{
          position: 'fixed',
          left: coords?.screenX ?? 0,
          top: coords?.screenY ?? 0,
        }}
      >
        {formattedCoords && (
          <>
            {/* Coordinates section */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MapPin className="mr-2 h-4 w-4" />
                Copy Coordinates
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuItem onClick={() => handleCopyCoords('decimal')}>
                  <span className="font-mono text-xs">{formattedCoords.decimal}</span>
                  <span className="ml-auto text-xs text-muted-foreground">DD</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopyCoords('dms')}>
                  <span className="font-mono text-xs">{formattedCoords.dms}</span>
                  <span className="ml-auto text-xs text-muted-foreground">DMS</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem onClick={handleCopyLink}>
              <Link className="mr-2 h-4 w-4" />
              Copy Link to Location
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Navigation className="mr-2 h-4 w-4" />
                Open in...
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleOpenInMaps('google')}>
                  Google Maps
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenInMaps('osm')}>
                  OpenStreetMap
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleOpenInMaps('ugs')}>
                  UGS Geologic Map
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Clear selection */}
            {hasSelection && onClearSelection && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleClearSelection} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Selection
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
