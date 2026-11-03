import { lazy, memo, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { surfaceStats } from '@/lib/map/dem-elevation'
import { queryKeys } from '@/lib/query-keys'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCoordinateFormat } from '@/hooks/use-map-coordinates'
import { formatCoordinatePair } from '@/lib/map/conversion-utils'
import { formatArea, formatElevation, formatLength, formatQuantity, measurementQuantity, type Measurement, type UnitSystem } from '@/lib/map/measure-store'
import { MEASURE_TOOLS } from '@/components/maps/measure-tools'

// Recharts is heavy; load it only once a line is finished
const ElevationProfile = lazy(() => import('./elevation-profile'))

/** Surface area and mean slope of a finished polygon, from the DEM. */
function AreaTerrain({ ring, areaM2, units }: { ring: [number, number][]; areaM2: number; units: UnitSystem }) {
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.dem.surfaceStats(ring),
    queryFn: () => surfaceStats(queryClient, ring, areaM2),
    staleTime: Infinity,
  })
  if (isPending) return <span className="text-muted-foreground">Measuring the terrain…</span>
  if (isError) return <span className="text-muted-foreground">Terrain stats unavailable</span>
  return (
    <>
      <span>Along the ground: {formatQuantity(formatArea(data.surfaceAreaM2, units))}</span>
      <span className="text-muted-foreground">Mean slope: {Math.round(data.meanSlopeDeg)}°</span>
    </>
  )
}

// Memoized: measurements keep their object while unchanged, so drawing doesn't re-render finished rows
export const MeasurementRow = memo(function MeasurementRow({ m, units, index, highlighted, onHighlight, onProfilePoint, onRemove }: {
  m: Measurement
  units: UnitSystem
  index: number
  highlighted: boolean
  onHighlight?: (id: string | number | undefined) => void
  onProfilePoint?: (owner: string | number, kind: 'pin' | 'hover', at: [number, number] | undefined) => void
  onRemove?: (id: string | number) => void
}) {
  const { coordinateFormat } = useCoordinateFormat()
  const { label, icon: Icon } = MEASURE_TOOLS[m.mode]
  const size = m.mode === 'point' ? undefined : measurementQuantity(m, units)
  const coords = m.coordinates && formatCoordinatePair(m.coordinates[0], m.coordinates[1], coordinateFormat, 5)
  return (
    // Hovering a row halos its shape on the map, and hovering the shape highlights the row
    <li
      data-measure-id={m.id}
      // Hovering the shape on the map highlights this row; bring it into view (not when the pointer is on it, or it jitters)
      ref={highlighted ? (el) => { if (el && !el.matches(':hover')) el.scrollIntoView({ block: 'nearest' }) } : undefined}
      onPointerEnter={() => onHighlight?.(m.id)}
      onPointerLeave={() => onHighlight?.(undefined)}
      className={cn('flex gap-3 rounded-sm bg-popover p-3 text-sm ring-primary', highlighted && 'ring-2')}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">{label} {index + 1}</span>
          {onRemove && (
            <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Remove ${label} ${index + 1}`} onClick={() => onRemove(m.id)}>
              <X className="size-4" />
            </Button>
          )}
        </div>
        {size && <span>{formatQuantity(size)}</span>}
        {m.segmentsM && m.segmentsM.length > 1 && (
          <span className="text-muted-foreground">Legs: {m.segmentsM.map((s) => formatQuantity(formatLength(s, units))).join(' · ')}</span>
        )}
        {m.perimeterM !== undefined && <span className="text-muted-foreground">Perimeter: {formatQuantity(formatLength(m.perimeterM, units))}</span>}
        {m.ring && m.areaM2 !== undefined && <AreaTerrain ring={m.ring} areaM2={m.areaM2} units={units} />}
        {coords?.map((c) => <span key={c.label}>{c.label}: {c.value}</span>)}
        {m.mode === 'point' && (
          <span>Elevation: {m.elevationM === undefined ? '…' : m.elevationM === null ? 'Unavailable' : formatQuantity(formatElevation(m.elevationM, units))}</span>
        )}
        {m.path && (
          <Suspense fallback={<span className="text-muted-foreground">Loading elevation profile…</span>}>
            <ElevationProfile id={m.id} path={m.path} units={units} onPoint={onProfilePoint} />
          </Suspense>
        )}
      </div>
    </li>
  )
})
