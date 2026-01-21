import type { DriveStep } from 'driver.js';

// =============================================================================
// Navigation Helper
// =============================================================================
// Updates URL search params to navigate sidebar tabs during tour

function navigateToTab(tab: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  url.searchParams.delete('sidebar_collapsed');
  window.history.replaceState({}, '', url.toString());
  // Dispatch a popstate event so React Router picks up the change
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function navigateToHome() {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', 'home');
  url.searchParams.delete('sidebar_collapsed');
  window.history.replaceState({}, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// =============================================================================
// Base Map Tour Steps
// =============================================================================
// These steps are common to all map routes

export const baseMapSteps: DriveStep[] = [
  {
    popover: {
      title: 'Welcome to the Map Viewer',
      description: 'This quick tour will show you the main features. You can exit anytime by clicking outside or pressing Escape.',
    },
  },
  {
    element: '[data-tour="sidebar-icons"]',
    popover: {
      title: 'Sidebar Navigation',
      description: 'Use these icons to switch between different panels: Info, Layers, Settings, and more.',
      side: 'right',
      align: 'start',
    },
    onHighlightStarted: () => {
      navigateToHome();
    },
  },
  {
    element: '[data-tour="layer-panel"]',
    popover: {
      title: 'Layer Panel',
      description: 'Toggle map layers on and off. Expand groups to see individual layers. Check a layer to display it on the map.',
      side: 'left',
      align: 'start',
    },
    onHighlightStarted: () => {
      navigateToTab('layers');
      // Small delay to let the component render
      return new Promise((resolve) => setTimeout(resolve, 100));
    },
  },
  {
    element: '[data-tour="search-box"]',
    popover: {
      title: 'Search',
      description: 'Search for addresses, features, and geologic units. Type at least 4 characters and select from results, or press Enter to search all.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="layer-opacity"]',
    popover: {
      title: 'Layer Opacity',
      description: 'Adjust the transparency of the selected layer using this slider.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '[data-tour="layer-legend"]',
    popover: {
      title: 'Legend',
      description: 'View symbology and colors for the selected layer.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '[data-tour="layer-export"]',
    popover: {
      title: 'Export Data',
      description: 'Download layer data as GeoJSON or Parquet format for use in other applications.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '[data-tour="basemap-selector"]',
    popover: {
      title: 'Basemap',
      description: 'Change the background map style between Imagery, Topo, Streets, and more.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="view-mode"]',
    popover: {
      title: 'View Mode',
      description: 'Switch between map view, split view with table, or full table view. Available after clicking the map.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '[data-tour="map-tools"]',
    popover: {
      title: 'Map Tools',
      description: 'Access drawing tools, measurement, and map export options.',
      side: 'left',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Tour Complete!',
      description: 'You can restart this tour anytime by clicking the help button in the sidebar. Happy exploring!',
    },
    onHighlightStarted: () => {
      navigateToHome();
    },
  },
];

// =============================================================================
// Feature-Specific Tour Steps
// =============================================================================
// Add steps for features that only exist on certain routes

export const ccsSteps: DriveStep[] = [
  {
    element: '[data-tour="unit-search"]',
    popover: {
      title: 'Geologic Unit Search',
      description: 'Search for geologic units by name or symbol. Select a unit to highlight all matching polygons on the map.',
      side: 'bottom',
      align: 'start',
    },
  },
];

export const hazardsSteps: DriveStep[] = [
  {
    element: '[data-tour="report-generator"]',
    popover: {
      title: 'Report Generator',
      description: 'Generate a PDF report for a selected area showing all hazard information.',
      side: 'left',
      align: 'center',
    },
    onHighlightStarted: () => {
      navigateToTab('report generator');
      return new Promise((resolve) => setTimeout(resolve, 100));
    },
  },
];

// =============================================================================
// Route to Steps Mapping
// =============================================================================

export type TourRoute = 'hazards' | 'ccs' | 'geologic' | 'groundwater' | 'energy' | 'wetlands';

const routeSteps: Record<TourRoute, DriveStep[]> = {
  hazards: hazardsSteps,
  ccs: ccsSteps,
  geologic: [],
  groundwater: [],
  energy: [],
  wetlands: [],
};

// =============================================================================
// Build Tour Steps
// =============================================================================

export function getTourSteps(route?: TourRoute): DriveStep[] {
  const steps = [...baseMapSteps];

  // Insert route-specific steps before the final "Tour Complete" step
  if (route && routeSteps[route] && routeSteps[route].length > 0) {
    const finalStep = steps.pop(); // Remove "Tour Complete" step
    steps.push(...routeSteps[route]);
    if (finalStep) steps.push(finalStep); // Add it back at the end
  }

  // Filter to only include steps where the element exists on the page
  // Skip filtering for steps without elements (intro/outro steps)
  return steps.filter((step) => {
    if (!step.element) return true;
    const element = document.querySelector(step.element as string);
    if (!element) return false;
    // Also check if element is visible (not hidden by CSS)
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}
