import { createFileRoute, redirect } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { RouteErrorBoundary } from '@/components/route-error-boundary'

export const HazardsReviewSearchParamsSchema = z.object({})

export const Route = createFileRoute('/_map/hazards-review')({
  validateSearch: HazardsReviewSearchParamsSchema,
  errorComponent: RouteErrorBoundary,
  beforeLoad: async ({ location }) => {
    // Bypass auth on dev + preview/develop builds; production (mode=production, master branch) still gates.
    if (import.meta.env.MODE !== 'production') return

    await new Promise<void>((resolve) => {
      const unsubscribe = auth.onAuthStateChanged(() => {
        unsubscribe()
        resolve()
      })
    })

    if (!auth.currentUser) {
      throw redirect({
        to: '/login',
        search: {
          redirectTo: location.href,
        },
      })
    }
  },
})