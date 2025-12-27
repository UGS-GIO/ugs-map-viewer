import { createLazyFileRoute } from '@tanstack/react-router'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import { AuthProvider } from '@/context/auth-provider'
import Map from './-index'

function HazardsReviewPage() {
    return (
        <AuthProvider>
            <Map />
        </AuthProvider>
    )
}

export const Route = createLazyFileRoute('/_map/hazards-review/')({
    errorComponent: RouteErrorBoundary,
    component: HazardsReviewPage,
})