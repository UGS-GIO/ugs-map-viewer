import { Layout } from '@/components/custom/layout'
import ThemeSwitch from '@/components/theme-switch'
import { TopNav } from '@/components/top-nav'
import { MapFooter } from '@/components/custom/map/map-footer'
import { cn } from '@/lib/utils'
import MapContainer from './components/map-container'
import Sidebar from '@/components/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { SIDEBAR_MARGINS } from '@/lib/sidebar-constants'

export default function Map() {
    const { isCollapsed, sidebarWidth } = useSidebar();
    const marginClass = isCollapsed ? SIDEBAR_MARGINS.icon : SIDEBAR_MARGINS[sidebarWidth];

    return (
        <div className="relative h-full overflow-hidden bg-background">
            <Sidebar />
            <main
                id="content"
                className={`overflow-x-hidden pt-16 transition-[margin] md:overflow-y-hidden md:pt-0 ${marginClass} h-full`}
            >
                <Layout>

                    {/* ===== Top Heading ===== */}
                    <Layout.Header>
                        <TopNav />
                        <div className='ml-auto flex items-center space-x-4'>
                            {/* Search Combobox goes here */}
                            <ThemeSwitch />
                        </div>
                    </Layout.Header>

                    {/* ===== Main ===== */}
                    <Layout.Body>
                        <MapContainer />
                    </Layout.Body>

                    {/* ===== Footer ===== */}
                    {/* no footer on mobile */}
                    <Layout.Footer className={cn('hidden md:flex z-10')} dynamicContent={<MapFooter />} />

                </Layout>
            </main>
        </div>
    )
}


