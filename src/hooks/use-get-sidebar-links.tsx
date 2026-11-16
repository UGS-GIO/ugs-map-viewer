// src/hooks/use-get-sidebar-links.ts
import { useQuery } from '@tanstack/react-query';
import { useGetCurrentPage } from "./use-get-current-page";
import { SideLink } from "@/lib/types/sidelink-types";
import { queryKeys } from '@/lib/query-keys';

/**
 * Fetches the sidebar links for the current page using TanStack Query.
 */
export const useGetSidebarLinks = () => {
    const currentPage = useGetCurrentPage();

    return useQuery<SideLink[], Error>({
        queryKey: queryKeys.sidebar.links(currentPage),

        // The function that performs the async data fetching.
        queryFn: async () => {
            // Loaded with the app's links so the Measure panel stays out of the main bundle
            const [module, { measureSidelink }] = await Promise.all([
                import(`@/routes/_map/${currentPage}/-data/sidelinks.tsx`),
                import('@/components/sidebar/measure-sidelink'),
            ]);
            const links: SideLink[] = module.sidelinks || [];
            // Measure is in every app, after Map Configurations
            const at = links.findIndex((l) => l.title === 'Map Configurations') + 1;
            return at > 0 ? [...links.slice(0, at), measureSidelink, ...links.slice(at)] : [...links, measureSidelink];
        },
        enabled: !!currentPage,
        staleTime: Infinity,    // These links are static, so we can cache them forever.
    });
};