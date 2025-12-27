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
import {
  Link,
  Search,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Trash2,
  MapPin,
  Navigation,
} from 'lucide-react'

export interface ContextMenuCoords {
  lng: number
  lat: number
  screenX: number
  screenY: number
}

interface MapContextMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  coords: ContextMenuCoords | null
  onQueryHere?: (coords: { lng: number; lat: number }) => void
  onClearSelection?: () => void
  onZoomIn?: (coords: { lng: number; lat: number }) => void
  onZoomOut?: (coords: { lng: number; lat: number }) => void
  onCenterHere?: (coords: { lng: number; lat: number }) => void
  hasSelection?: boolean
  currentZoom?: number
}

export function MapContextMenu({
  open,
  onOpenChange,
  coords,
  onQueryHere,
  onClearSelection,
  onZoomIn,
  onZoomOut,
  onCenterHere,
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
    url.searchParams.set('lng', coords.lng.toFixed(6))
    url.searchParams.set('z', currentZoom.toFixed(1))
    navigator.clipboard.writeText(url.toString())
    toast({ description: 'Link copied to clipboard' })
    onOpenChange(false)
  }, [coords, currentZoom, toast, onOpenChange])

  // Open in external map services
  const handleOpenInMaps = useCallback((service: 'google' | 'apple' | 'osm' | 'bing') => {
    if (!coords) return
    const { lat, lng } = coords
    const urls = {
      google: `https://www.google.com/maps?q=${lat},${lng}`,
      apple: `https://maps.apple.com/?ll=${lat},${lng}&q=${lat},${lng}`,
      osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=${Math.round(currentZoom)}`,
      bing: `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=${Math.round(currentZoom)}`,
    }
    window.open(urls[service], '_blank')
    onOpenChange(false)
  }, [coords, currentZoom, onOpenChange])

  // Query features at this location
  const handleQueryHere = useCallback(() => {
    if (!coords || !onQueryHere) return
    onQueryHere({ lng: coords.lng, lat: coords.lat })
    onOpenChange(false)
  }, [coords, onQueryHere, onOpenChange])

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (!coords || !onZoomIn) return
    onZoomIn({ lng: coords.lng, lat: coords.lat })
    onOpenChange(false)
  }, [coords, onZoomIn, onOpenChange])

  const handleZoomOut = useCallback(() => {
    if (!coords || !onZoomOut) return
    onZoomOut({ lng: coords.lng, lat: coords.lat })
    onOpenChange(false)
  }, [coords, onZoomOut, onOpenChange])

  const handleCenterHere = useCallback(() => {
    if (!coords || !onCenterHere) return
    onCenterHere({ lng: coords.lng, lat: coords.lat })
    onOpenChange(false)
  }, [coords, onCenterHere, onOpenChange])

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

            {/* Query section */}
            {onQueryHere && (
              <DropdownMenuItem onClick={handleQueryHere}>
                <Search className="mr-2 h-4 w-4" />
                Query Features Here
              </DropdownMenuItem>
            )}

            {/* Navigation section */}
            <DropdownMenuSeparator />

            {onCenterHere && (
              <DropdownMenuItem onClick={handleCenterHere}>
                <Crosshair className="mr-2 h-4 w-4" />
                Center Map Here
              </DropdownMenuItem>
            )}

            {onZoomIn && (
              <DropdownMenuItem onClick={handleZoomIn}>
                <ZoomIn className="mr-2 h-4 w-4" />
                Zoom In Here
              </DropdownMenuItem>
            )}

            {onZoomOut && (
              <DropdownMenuItem onClick={handleZoomOut}>
                <ZoomOut className="mr-2 h-4 w-4" />
                Zoom Out Here
              </DropdownMenuItem>
            )}

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Navigation className="mr-2 h-4 w-4" />
                Open in...
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleOpenInMaps('google')}>
                  Google Maps
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenInMaps('apple')}>
                  Apple Maps
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenInMaps('osm')}>
                  OpenStreetMap
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenInMaps('bing')}>
                  Bing Maps
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
