import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { UgsLogo } from '@/components/ugs-logo'
import { TopNav } from '@/components/top-nav'
import { useSidebar } from '@/hooks/use-sidebar'
import { useGetCurrentPage } from '@/hooks/use-get-current-page'
import { getAppTitle } from '@/lib/app-titles'

interface AppBarProps {
    /** Route-specific search control, rendered at the end of the bar. */
    search?: React.ReactNode
    /** Route-specific controls (e.g. the review app's account menu). */
    actions?: React.ReactNode
}

const AppBar = ({ search, actions }: AppBarProps) => {
    const { navOpened, setNavOpened, isCollapsed, setIsCollapsed } = useSidebar()
    const appTitle = getAppTitle(useGetCurrentPage())

    const handleMenuClick = () => {
        setNavOpened(prev => !prev)
        if (!isCollapsed) setIsCollapsed(true)
    }

    return (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-3 md:px-4">
            <Button
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden"
                aria-label="Toggle navigation"
                aria-controls="sidebar-menu"
                aria-expanded={navOpened}
                onClick={handleMenuClick}
            >
                {navOpened ? <X /> : <Menu />}
            </Button>

            <Link to="https://geology.utah.gov/" className="shrink-0">
                <UgsLogo variant="mark" className="h-8 w-auto" />
            </Link>

            <h1 className="min-w-0 truncate font-display text-base font-medium md:text-lg">{appTitle}</h1>

            <div className="ml-auto flex min-w-0 items-center gap-2 md:gap-4">
                <TopNav />
                {search && <div className="hidden min-w-0 md:block md:w-64 lg:w-80">{search}</div>}
                {actions}
            </div>
        </header>
    )
}

export { AppBar }
