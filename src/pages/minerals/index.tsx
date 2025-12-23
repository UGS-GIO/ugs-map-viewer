import { Layout } from '@/components/custom/layout'
import { TopNav } from '@/components/top-nav'
import { MapFooter } from '@/components/custom/map/map-footer'
import { cn } from '@/lib/utils'
import MapContainer from './components/map-container'
import Sidebar from '@/components/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'

export default function Map() {
    const { isCollapsed, sidebarWidthPx } = useSidebar();
    const sidebarMargin = isCollapsed ? 56 : sidebarWidthPx;

    return (
        <div className="relative h-full overflow-hidden bg-background">
            <Sidebar />
            <main
                id="content"
                className="overflow-x-hidden pt-16 transition-[margin] duration-200 ease-linear md:overflow-y-hidden md:pt-0 h-full max-md:!ml-0"
                style={{ marginLeft: `${sidebarMargin}px` }}
            >
                <Layout>

                    {/* ===== Top Heading ===== */}
                    <Layout.Header>
                        <TopNav />
                        <div className='ml-auto flex items-center space-x-4'>
                            {/* <SearchCombobox /> goes here */}
                        </div>
                    </Layout.Header>

                    {/* ===== Main ===== */}
                    <Layout.Body>
                        <MapContainer />
                    </Layout.Body>

                    {/* ===== Footer ===== */}
                    {/* no footer on mobile */}
                    <Layout.Footer className={cn('hidden md:flex z-20')} dynamicContent={<MapFooter />} />

                </Layout>
            </main>
        </div>
    )
}


