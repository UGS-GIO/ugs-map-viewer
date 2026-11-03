import { useMutation } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { shapesFromGeoJSON, type LoadedShape } from '@/lib/map/measure-features'

// More than this and the panel turns into a wall of profiles; measure a few, not a dataset
const MAX_SHAPES = 100
const ACCEPT = '.geojson,.json,.zip,.gpkg,.fgb,.kml,.kmz,.gml'

async function readShapes(file: File) {
  // GeoJSON parses directly; anything else goes through GDAL, which loads (~40 MB) only then
  const text = /\.(geo)?json$/i.test(file.name)
    ? await file.text()
    : await (await import('@/lib/gdal-export')).readAsGeoJSON(file)
  const shapes = shapesFromGeoJSON(JSON.parse(text))
  if (!shapes.length) throw new Error(`No lines, areas or points found in "${file.name}".`)
  return shapes
}

/** Loads lines, areas and points from a file as measurements. */
export function LoadShapes({ onLoad }: { onLoad?: (shapes: LoadedShape[]) => number }) {
  const { mutate, isPending, data, error } = useMutation({
    mutationFn: async (file: File) => {
      const shapes = await readShapes(file)
      const added = onLoad?.(shapes.slice(0, MAX_SHAPES)) ?? 0
      const capped = shapes.length > MAX_SHAPES ? ` (the first ${MAX_SHAPES})` : ''
      const rejected = Math.min(shapes.length, MAX_SHAPES) - added
      return `Loaded ${added} of ${shapes.length} ${shapes.length === 1 ? 'shape' : 'shapes'} from "${file.name}"${capped}.${rejected > 0 ? ` ${rejected} couldn't be drawn, such as self-crossing areas.` : ''}`
    },
  })

  return (
    <div className="mt-3 grid gap-1">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-sm bg-popover p-2 text-sm hover:bg-accent hover:text-accent-foreground focus-within:ring-2 focus-within:ring-ring md:p-3">
        <Upload className="size-4" />
        {isPending ? 'Reading file…' : 'Load shapes from a file'}
        <input
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={isPending}
          onChange={(e) => {
            const file = e.target.files?.[0]
            // Clear so picking the same file again still fires
            e.target.value = ''
            if (file) mutate(file)
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">GeoJSON, KML, GeoPackage, FlatGeobuf, or a zipped Shapefile or File Geodatabase.</p>
      {error && <p className="text-xs text-destructive">{error.message}</p>}
      {data && <p className="text-xs text-muted-foreground">{data}</p>}
    </div>
  )
}
