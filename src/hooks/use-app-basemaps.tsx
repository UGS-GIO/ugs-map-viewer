import { resolveAppBasemaps, type AppBasemaps } from '@/lib/basemaps';
import { useGetCurrentPage } from '@/hooks/use-get-current-page';

/** The basemap menu and default for the app being viewed. */
export function useAppBasemaps(): AppBasemaps {
    return resolveAppBasemaps(useGetCurrentPage());
}
