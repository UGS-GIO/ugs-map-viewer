import { LandPlot, MapPin, Spline, type LucideIcon } from 'lucide-react'
import type { MeasureMode } from '@/lib/map/measure-store'

/** Icon and wording for each measure tool, shared by the map tools and the sidebar panel. */
export const MEASURE_TOOLS: Record<MeasureMode, { icon: LucideIcon; label: string; title: string; hint: string }> = {
  linestring: { icon: Spline, label: 'Distance', title: 'Measure distance', hint: 'Click to add points, click the last one again to finish.' },
  polygon: { icon: LandPlot, label: 'Area', title: 'Measure area', hint: 'Click to add corners, click the first one to close.' },
  point: { icon: MapPin, label: 'Point', title: 'Point location and elevation', hint: 'Click the map for coordinates and elevation.' },
}
