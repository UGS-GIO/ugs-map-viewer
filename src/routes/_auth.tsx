import { createFileRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import { AuthProvider } from '@/context/auth-provider'

const authSearchSchema = z.object({
    redirectTo: z.string().optional(),
})

function AuthLayout() {
    return (
        <AuthProvider>
            {/* #root is overflow:clip (fixed viewport, never a scroll container), so auth
                routes own their own scroller — otherwise the card is clipped on short viewports. */}
            <div className="h-full overflow-y-auto">
                <Outlet />
            </div>
        </AuthProvider>
    )
}

export const Route = createFileRoute('/_auth')({
    validateSearch: authSearchSchema,
    errorComponent: RouteErrorBoundary,
    component: AuthLayout,
})