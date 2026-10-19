import { createLazyFileRoute } from '@tanstack/react-router'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import Map from './-index'

// No AuthProvider here — /review-stac is served behind IAP; identity comes from /whoami, not Firebase.
export const Route = createLazyFileRoute('/_map/review-stac/')({
  errorComponent: RouteErrorBoundary,
  component: Map,
})
