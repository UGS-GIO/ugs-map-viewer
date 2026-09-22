import { useState, useMemo } from 'react';
import GenericMapContainer from '@/components/maps/generic-map-container';
import { MapShell } from '@/components/maps/map-shell'
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
import { DisplacementAnalysisProvider } from './-components/popups/displacement-analysis-context';
import { DisplacementAnalysisHost } from './-components/popups/displacement-analysis-host';
import { useDisplacementLatestYearByType } from './-components/popups/use-displacement-queries';
import { renderDisplacementLayerHeader } from './-components/popups/displacement-layer-charts';
import { makeDisplacementPopupFeatureFilter } from './-components/popups/displacement-popup-filter';
import type { DisplacementType } from './-components/popups/displacement-layers';
import { TourAutoStart } from '@/components/tour-auto-start';

export default function Map() {
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
    <DisplacementAnalysisProvider>
      <TourAutoStart route="hazards" />
      <>
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
        <MapShell
          actions={
            <DropdownMenu modal={false}>
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
          }
        >
          <FilteredMapContainer />
        </MapShell>
        <DisplacementAnalysisHost />
      </>
    </DisplacementAnalysisProvider>
    </DisplacementFilterProvider>
    </MapContext.Provider>
  )
}

function FilteredMapContainer() {
  const { yearOverridesByType, basinsByType } = useDisplacementFilters()
  const { byType: latestByType } = useDisplacementLatestYearByType()
  const layerFilters = useDisplacementLayerFilters()
  // Build a per-type concrete year map: that type's user pick wins, else latest
  // from data. Per-type so one layer's year never leaks into another's popup.
  const popupFeatureFilter = useMemo(() => {
    const effectiveYearByType: Record<DisplacementType, string | null> = {
      'Cumulative': yearOverridesByType['Cumulative'] ?? latestByType['Cumulative'] ?? null,
      'Yearly': yearOverridesByType['Yearly'] ?? latestByType['Yearly'] ?? null,
      'Vertical Displacement Rate': yearOverridesByType['Vertical Displacement Rate'] ?? latestByType['Vertical Displacement Rate'] ?? null,
    }
    return makeDisplacementPopupFeatureFilter({ effectiveYearByType, basinsByType })
  }, [yearOverridesByType, latestByType, basinsByType])
  return (
    <GenericMapContainer
      layerFilters={layerFilters}
      popupLayerHeaderRender={renderDisplacementLayerHeader}
      popupFeatureFilter={popupFeatureFilter}
    />
  )
}