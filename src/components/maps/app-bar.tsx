import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TopNav } from '@/components/top-nav'
import { useSidebar } from '@/hooks/use-sidebar'
import { useGetCurrentPage } from '@/hooks/use-get-current-page'
import { getAppTitle } from '@/lib/app-titles'
import { UgsLogo } from '@/components/ugs-logo'

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

            {/* This bar is the only header: the app owns the lockup, the title, and the controls. */}
            <a
                href="https://geology.utah.gov"
                aria-label="Utah Geological Survey home"
                className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                {/* The wide lockup costs the title its room on a phone; the mark carries it there. */}
                <span className="sm:hidden">
                    <UgsLogo variant="mark" alt="" className="h-8 w-auto" />
                </span>
                <span className="hidden sm:block">
                    <UgsLogo alt="" className="h-9 w-auto md:h-10" />
                </span>
            </a>

            <span className="hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

            <h1 className="min-w-0 truncate font-display text-sm font-medium md:text-base">{appTitle}</h1>

            <div className="ml-auto flex min-w-0 items-center gap-2 md:gap-4">
                <TopNav />
                {search && <div className="hidden min-w-0 md:block md:w-64 lg:w-80">{search}</div>}
                {actions}
            </div>
        </header>
    )
}

export { AppBar }
