import { createLazyFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { HazardsReport } from '@/routes/_report/-components/hazards-report'
import { deserializePolygonFromUrl } from '@/lib/map/conversion-utils'

// Match the schema from parent route
const HazardsSearchSchema = z.object({
  aoi: z.union([
    z.string(),
    z.object({}).passthrough()
  ]).optional()
})

type HazardsSearch = z.infer<typeof HazardsSearchSchema>

export const Route = createLazyFileRoute('/_report/hazards/report')({
  component: HazardsReportRoute,
})

function HazardsReportRoute() {
  const search = Route.useSearch() as HazardsSearch
  let aoiString = ''

  if (search.aoi) {
    try {
      let aoiValue: string;

      // If it's already an object (TanStack Router parsed it), stringify it back
      if (typeof search.aoi === 'object') {
        aoiValue = JSON.stringify(search.aoi);
      } else {
        // If it's a string, use it directly
        aoiValue = search.aoi;
      }

      // Deserialize the polygon from the URL string
      const polygon = deserializePolygonFromUrl(aoiValue);
      if (polygon) {
        aoiString = JSON.stringify(polygon);
      }
    } catch (error) {
      console.error('Failed to process polygon from URL:', error)
    }
  }

  return <HazardsReport polygon={aoiString} />
}
