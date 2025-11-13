import { createLazyFileRoute } from '@tanstack/react-router'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import Map from '@/pages/minerals'

export const Route = createLazyFileRoute('/_map/minerals/')({
  errorComponent: RouteErrorBoundary,
  component: () => <Map />,
})
