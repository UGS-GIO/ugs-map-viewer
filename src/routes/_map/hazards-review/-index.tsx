import { useState } from 'react';
import { Layout } from '@/components/layout/layout';
import { TopNav } from '@/components/top-nav';
import { MapFooter } from '@/components/maps/map-footer';
import { cn } from '@/lib/utils';
import GenericMapContainer from '@/components/maps/generic-map-container';
import Sidebar from '@/components/sidebar';
import { useSidebar } from '@/hooks/use-sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { signOut } from '@/lib/auth';
import { useAuth } from '@/context/auth-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useMapContextState } from '@/hooks/use-map-context-state';
import { MapContext } from '@/context/map-context';
import { DisplacementFilterProvider, useDisplacementFilters, useDisplacementLayerFilters } from './-components/popups/displacement-filter-context';
import { useDisplacementLatestYearByType } from './-components/popups/use-displacement-queries';
import { renderDisplacementLayerHeader } from './-components/popups/displacement-layer-charts';
import { makeDisplacementPopupFeatureFilter } from './-components/popups/displacement-popup-filter';
import type { DisplacementType } from './-components/popups/displacement-layers';
import { TourAutoStart } from '@/components/tour-auto-start';

export default function Map() {
  const { isCollapsed, sidebarWidthPx } = useSidebar();
  const isMobile = useIsMobile();
  const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);
  const { user } = useAuth();
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);
  const { contextValue } = useMapContextState();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Get user initials for avatar
  const getUserInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  return (
    <MapContext.Provider value={contextValue}>
    <DisplacementFilterProvider>
      <TourAutoStart route="hazards" />
      <div className="relative h-svh overflow-hidden bg-background">
        <AlertDialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>How to use this web application:</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="space-y-3 text-left">
                <li className="flex gap-2">
                  <span className="font-bold shrink-0">•</span>
                  <span>
                    <strong>Anticipate a brief loading period</strong>, as the application manages a substantial data volume and numerous layers.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold shrink-0">•</span>
                  <span>
                    <strong>Toggle hazard layers</strong> using the layer controls window. Each layer's visibility can be controlled independently.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold shrink-0">•</span>
                  <span>
                    <strong>Select map features</strong> to view the corresponding hazard information as it would appear in the live Geologic Hazards Portal.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold shrink-0">•</span>
                  <span>
                    <strong>Utilize the map interface</strong> to fully explore the data and send comments and/or screenshots to Geologic Hazards Program staff for revisions.
                  </span>
                </li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowWelcomeDialog(false)}>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="absolute top-4 right-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full bg-background/95 backdrop-blur-sm border">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user?.email ? getUserInitials(user.email) : <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs text-muted-foreground">Logged in as</p>
                <p className="text-sm font-medium leading-none truncate">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Sidebar />
      <main
        id="content"
        className="overflow-x-hidden pt-[var(--header-height)] transition-[margin] duration-200 ease-linear md:overflow-y-hidden md:pt-0 h-full"
        style={{ marginLeft: `${sidebarMargin}px` }}
      >
        <Layout>
          <Layout.Header className='hidden md:flex items-center justify-between px-4 md:px-6'>
            <TopNav />
            <div className='flex items-center flex-1 min-w-0 md:flex-initial md:w-1/3 md:ml-auto space-x-2'>
              {/* SearchCombobox removed - needs refactoring for new architecture */}
            </div>
          </Layout.Header>

          <Layout.Body>
            <FilteredMapContainer />
          </Layout.Body>

          <Layout.Footer className={cn('hidden md:flex z-20')} dynamicContent={<MapFooter />} />
        </Layout>
      </main>
    </div>
    </DisplacementFilterProvider>
    </MapContext.Provider>
  )
}

function FilteredMapContainer() {
  const { yearOverride, basinsByType } = useDisplacementFilters()
  const latestByType = useDisplacementLatestYearByType()
  const layerFilters = useDisplacementLayerFilters()
  // Build a per-type concrete year map: user pick wins, else latest from data.
  const effectiveYearByType: Record<DisplacementType, string | null> = {
    'Cumulative': yearOverride ?? latestByType['Cumulative'] ?? null,
    'Yearly': yearOverride ?? latestByType['Yearly'] ?? null,
    'Vertical Displacement Rate': yearOverride ?? latestByType['Vertical Displacement Rate'] ?? null,
  }
  const popupFeatureFilter = makeDisplacementPopupFeatureFilter({ effectiveYearByType, basinsByType })
  return (
    <GenericMapContainer
      layerFilters={layerFilters}
      popupLayerHeaderRender={renderDisplacementLayerHeader}
      popupFeatureFilter={popupFeatureFilter}
    />
  )
}