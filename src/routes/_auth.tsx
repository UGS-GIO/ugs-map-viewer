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
            <Outlet />
        </AuthProvider>
    )
}

export const Route = createFileRoute('/_auth')({
    validateSearch: authSearchSchema,
    errorComponent: RouteErrorBoundary,
    component: AuthLayout,
})