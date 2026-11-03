import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import type { FeatureCollection } from 'geojson'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EXPORT_FORMATS } from '@/lib/export-formats'
import { downloadBytes } from '@/lib/download-utils'
import { measurementLayers } from '@/lib/map/measure-features'
import type { Measurement, UnitSystem } from '@/lib/map/measure-store'
import { MEASURE_TOOLS } from '@/components/maps/measure-tools'

const STEM = 'measurements'
const FORMATS = [
  { format: 'gpkg', ...EXPORT_FORMATS.gpkg },
  { format: 'shp', ...EXPORT_FORMATS.shp },
  { format: 'gdb', ...EXPORT_FORMATS.gdb },
  { format: 'kml', label: 'KML', hint: '.kml' },
  { format: 'geojson', ...EXPORT_FORMATS.geojson },
] as const
type Format = (typeof FORMATS)[number]['format']

async function exportShapes(format: Format, layers: [string, FeatureCollection][]) {
  // GeoJSON and KML hold mixed geometry in one layer; GDAL loads (~40 MB) only for the others
  const all = JSON.stringify({ type: 'FeatureCollection', features: layers.flatMap(([, fc]) => fc.features) })
  if (format === 'geojson') return downloadBytes(new TextEncoder().encode(all), `${STEM}.geojson`, 'application/geo+json')
  const gdal = await import('@/lib/gdal-export')
  const { bytes, filename, mime } = format === 'kml'
    ? await gdal.convertGeoJSON(all, STEM, { driver: 'KML', ext: 'kml', multi: false })
    : await gdal.convertGeoJSONLayers(layers.map(([name, fc]) => [name, JSON.stringify(fc)]), STEM, gdal.GDAL_TARGETS[format])
  downloadBytes(bytes, filename, mime)
}

/** Saves the measurements as a file GIS apps like ArcGIS Pro and QGIS open. */
export function ExportShapes({ measurements, units }: { measurements: Measurement[]; units: UnitSystem }) {
  const { mutate, isPending, error } = useMutation({
    mutationFn: (format: Format) => exportShapes(format, measurementLayers(measurements, (m, i) => `${MEASURE_TOOLS[m.mode].label} ${i + 1}`, units)),
  })
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={isPending}>
            <Download className="size-4" /> {isPending ? 'Exporting…' : 'Export'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {FORMATS.map(({ format, label, hint }) => (
            <DropdownMenuItem key={format} onClick={() => mutate(format)}>
              {label}
              <span className="ml-auto pl-4 text-xs text-muted-foreground">{hint}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <p className="basis-full text-xs text-destructive">{error.message}</p>}
    </>
  )
}
