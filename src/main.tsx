import '@fontsource-variable/source-sans-3' // Utah Design System body font, self-hosted
import '@utahdts/utah-design-system-header/css'
import '@/index.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { loadHeader, type SettingsInput, setUtahHeaderSettings } from '@utahdts/utah-design-system-header'
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from '@/context/theme-provider'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import proj4 from 'proj4'
import ugsMark from '@/assets/ugs-mark.png'
import { setupPMTilesProtocol } from '@/lib/map/pmtiles/setup'
import { setupCOGProtocol } from '@/lib/map/cog/setup'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Mount the official State of Utah header ONCE, imperatively — the design system
// package renders itself into the DOM outside React (as a sibling of #root), so
// this is a module-scope side effect at startup, NOT a component effect. index.css
// stacks it above #root and hides its title band on mobile, where the sidebar's top
// bar carries the logo + app name instead.
const headerSettings: SettingsInput = {
  title: 'Utah Geological Survey',
  showTitle: true,
  size: 'SMALL',
  titleUrl: 'https://geology.utah.gov',
  logo: { imageUrl: ugsMark }, // mark only — the header renders the agency name itself
  mainMenu: false, // portal navigation lives in the app sidebar
  utahId: false,
  footer: null, // required legal links live in the in-app map footer
}
setUtahHeaderSettings(headerSettings)
loadHeader()

// Apply the stored theme before first paint. ThemeProvider does the same in an
// effect, which lands after the first paint — enough for a light flash on a dark
// map, and very visible now that the light Utah header sits above the app.
const storedTheme = localStorage.getItem('vite-ui-theme') ?? 'dark'
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.classList.add(
  storedTheme === 'system' ? (prefersDark ? 'dark' : 'light') : storedTheme
)

// Initialize PMTiles protocol (runs once at app start)
setupPMTilesProtocol()
setupCOGProtocol()

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes - data stays fresh
      gcTime: 30 * 60 * 1000,        // 30 minutes - cache persists
      retry: 1,                       // Single retry on failure
      refetchOnWindowFocus: false,   // Don't refetch when tab regains focus
    },
  },
})

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