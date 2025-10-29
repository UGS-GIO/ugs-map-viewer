import { createFileRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'
import { RouteErrorBoundary } from '@/components/route-error-boundary'

const authSearchSchema = z.object({
    redirectTo: z.string().optional(),
})

export const Route = createFileRoute('/_auth')({
    validateSearch: authSearchSchema,
    errorComponent: RouteErrorBoundary,
    component: () => <Outlet />,
})