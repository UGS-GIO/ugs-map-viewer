import ComingSoon from '@/components/coming-soon'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    beforeLoad: () => {
        // Review build (served behind IAP at /review/app/) lands reviewers straight on the review section.
        if (import.meta.env.MODE === 'review') throw redirect({ to: '/review-stac' })
    },
    component: RouteComponent,
})

function RouteComponent() {
    // #root is overflow:clip (fixed viewport, never a scroll container), so this route
    // owns its own scroller — otherwise its content is clipped on short viewports.
    return (
        <div className="h-full overflow-y-auto">
            <ComingSoon />
        </div>
    )
}
