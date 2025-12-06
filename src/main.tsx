import '@/index.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from '@/context/theme-provider'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import proj4 from 'proj4'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

proj4.defs("EPSG:26912", "+proj=utm +zone=12 +ellps=GRS80 +datum=NAD83 +units=m +no_defs");
// defs for 3857
// proj4.defs("EPSG:3857", "+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=6378137 +b=6378137 +units=m +no_defs");
proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs");

proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs");

// Create a new router instance
const router = createRouter({ routeTree })

// Lazy load Firebase Analytics - only initialize when user navigates
let analyticsInitialized = false;
const initAnalyticsOnce = async () => {
  if (analyticsInitialized) return;
  analyticsInitialized = true;

  try {
    const { getAnalytics, logEvent } = await import('firebase/analytics');
    const analytics = getAnalytics();
    logEvent(analytics, 'app_initialized');
  } catch (error) {
    console.warn('Analytics not available:', error);
  }
};

// Initialize analytics on first navigation
router.subscribe('onResolved', () => {
  initAnalyticsOnce();
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)