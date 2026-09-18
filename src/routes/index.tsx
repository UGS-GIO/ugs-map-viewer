import ComingSoon from '@/components/coming-soon'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
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
