import { cn } from '@/lib/utils'
import { MapFooter } from '@/components/maps/map-footer'

// Full-width footer, a sibling of the sidebar rather than a child of <main>, so its
// top border runs the whole window instead of stopping at the sidebar edge.
const MapFooterBar = ({ className }: { className?: string }) => (
    <footer
        data-layout="footer"
        className={cn(
            'z-20 hidden shrink-0 items-center justify-between gap-x-3 border-t bg-background px-2 py-1 md:flex md:py-2',
            className
        )}
    >
        <MapFooter />
    </footer>
)

export { MapFooterBar }
