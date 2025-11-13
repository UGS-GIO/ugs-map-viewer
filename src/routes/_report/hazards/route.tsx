import { createFileRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'
import { RouteErrorBoundary } from '@/components/route-error-boundary'

// Zod schema for validating query parameters on /hazards/report route
// Accept both string and object, handle both in the component
const HazardsSearchSchema = z.object({
  aoi: z.union([
    z.string(),
    z.object({}).passthrough()
  ]).optional()
})

export const Route = createFileRoute('/_report/hazards')({
  validateSearch: HazardsSearchSchema,
  errorComponent: RouteErrorBoundary,
  component: () => <Outlet />,
})