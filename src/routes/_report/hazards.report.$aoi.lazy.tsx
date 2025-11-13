import { createLazyFileRoute } from '@tanstack/react-router'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import Report from '@/pages/hazards/report'

export const Route = createLazyFileRoute('/_report/hazards/report/$aoi')({
    errorComponent: RouteErrorBoundary,
    component: Report
})