import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { RouteErrorBoundary } from '@/components/route-error-boundary'

export const ReviewStacSearchParamsSchema = z.object({})

export const Route = createFileRoute('/_map/review-stac')({
  validateSearch: ReviewStacSearchParamsSchema,
  errorComponent: RouteErrorBoundary,
  beforeLoad: () => {
    // The review STAC catalog is only reachable same-origin behind IAP (the review build). In the
    // public build it can't load, so this route is inert there — bounce to home.
    if (import.meta.env.MODE !== 'review') throw redirect({ to: '/' })
  },
})
