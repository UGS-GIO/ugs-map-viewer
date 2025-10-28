import { createLazyFileRoute } from '@tanstack/react-router'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import Map from '@/pages/hazards-review'

export const Route = createLazyFileRoute('/_map/hazards-review/')({
    errorComponent: RouteErrorBoundary,
    component: () => <Map />,
})