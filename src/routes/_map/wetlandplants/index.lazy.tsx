import { createLazyFileRoute } from '@tanstack/react-router'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import Map from '@/pages/wetlandplants'

export const Route = createLazyFileRoute('/_map/wetlandplants/')({
  errorComponent: RouteErrorBoundary,
  component: () => <Map />,
})