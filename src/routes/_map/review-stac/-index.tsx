/**
 * /review-stac — a map view whose layers ARE the review STAC catalog (auto-discovered), served
 * same-origin behind review-serving's IAP. Reviewer identity comes from /whoami (IAP). Only functional
 * in the IAP review build; the public build can't reach the private catalog (route guard bounces it).
 */
import { Layout } from '@/components/layout/layout';
import { TopNav } from '@/components/top-nav';
import { MapFooter } from '@/components/maps/map-footer';
import { cn } from '@/lib/utils';
import GenericMapContainer from '@/components/maps/generic-map-container';
import Sidebar from '@/components/sidebar';
import { useSidebar } from '@/hooks/use-sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMapContextState } from '@/hooks/use-map-context-state';
import { MapContext } from '@/context/map-context';
import { useWhoami } from '@/hooks/use-whoami';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { ReviewFilterProvider } from './-components/review-filter-context';
import { useReviewVectorFilters } from './-components/layer-filters';
import { useReviewDisplacementParquetUrl } from './-components/use-review-displacement';
import { DisplacementSourceProvider } from '@/routes/_map/hazards-review/-components/popups/displacement-data-source';
import { DisplacementFilterProvider } from '@/routes/_map/hazards-review/-components/popups/displacement-filter-context';
import { useDisplacementVectorFilters } from '@/routes/_map/hazards-review/-components/popups/displacement-vector-filters';

export default function ReviewStacMap() {
  // Displacement stats/filters read the review geoparquet (never GeoServer). All filter state wraps both
  // the sidebar (Filters slot writes) and the map (reads → vectorLayerFilters).
  const parquetUrl = useReviewDisplacementParquetUrl();
  return (
    <ReviewFilterProvider>
      <DisplacementSourceProvider value={{ kind: 'parquet', parquetUrl: parquetUrl ?? '' }}>
        <DisplacementFilterProvider>
          <ReviewStacMapContent />
        </DisplacementFilterProvider>
      </DisplacementSourceProvider>
    </ReviewFilterProvider>
  );
}

function ReviewStacMapContent() {
  const { isCollapsed, sidebarWidthPx } = useSidebar();
  const isMobile = useIsMobile();
  const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);
  const { contextValue } = useMapContextState();
  const { email, user } = useWhoami();
  const vectorLayerFilters = { ...useReviewVectorFilters(), ...useDisplacementVectorFilters() };

  return (
    <MapContext.Provider value={contextValue}>
      <div className="relative h-svh overflow-hidden bg-background">
        <div className="absolute top-4 right-4 z-50">
          <div
            className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs backdrop-blur-sm"
            title={email ?? undefined}
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                {user ? user.slice(0, 2).toUpperCase() : <User className="h-3 w-3" />}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground">{user ?? 'signed in'}</span>
          </div>
        </div>

        <Sidebar />
        <main
          id="content"
          className="h-full overflow-x-hidden pt-[var(--header-height)] transition-[margin] duration-200 ease-linear md:overflow-y-hidden md:pt-0"
          style={{ marginLeft: `${sidebarMargin}px` }}
        >
          <Layout>
            <Layout.Header className="hidden items-center justify-between px-4 md:flex md:px-6">
              <TopNav />
            </Layout.Header>
            <Layout.Body>
              <GenericMapContainer layerConfigKey="review-stac" vectorLayerFilters={vectorLayerFilters} />
            </Layout.Body>
            <Layout.Footer className={cn('z-20 hidden md:flex')} dynamicContent={<MapFooter />} />
          </Layout>
        </main>
      </div>
    </MapContext.Provider>
  );
}
