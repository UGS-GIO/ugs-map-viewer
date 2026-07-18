import ComingSoon from '@/components/coming-soon'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    beforeLoad: () => {
        // Review build (served behind IAP at /review/app/) lands reviewers straight on the review section.
        if (import.meta.env.MODE === 'review') throw redirect({ to: '/hazards-review' })
    },
    component: RouteComponent,
})

function RouteComponent() {
    return <ComingSoon />
}
