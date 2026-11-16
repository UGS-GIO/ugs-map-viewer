import { MapPin, Spline, VectorSquare, type LucideIcon } from 'lucide-react'
import type { MeasureMode } from '@/lib/map/measure-store'

/** Icon and wording for each measure tool, shared by the map tools and the sidebar panel. */
export const MEASURE_TOOLS: Record<MeasureMode, { icon: LucideIcon; label: string; title: string; hint: string }> = {
  linestring: { icon: Spline, label: 'Distance', title: 'Measure distance', hint: 'Click the map to start a line and again at each bend. Click the last point again, press Enter or tap Finish line to finish; Esc cancels.' },
  polygon: { icon: VectorSquare, label: 'Area', title: 'Measure area', hint: 'Click the map at each corner. Click the first corner again, press Enter or tap Close shape to close it; Esc cancels.' },
  point: { icon: MapPin, label: 'Point', title: 'Point location and elevation', hint: 'Click the map to drop a point and see its coordinates and ground elevation.' },
}
