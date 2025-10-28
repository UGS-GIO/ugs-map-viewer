import { createLazyFileRoute } from '@tanstack/react-router'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import Map from '@/pages/geophysics'

export const Route = createLazyFileRoute('/_map/geophysics/')({
  errorComponent: RouteErrorBoundary,
  component: () => <Map />,
})
