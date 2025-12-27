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
            const module = await import(`@/routes/_map/${currentPage}/-data/sidelinks.tsx`);
            return module.sidelinks || [];
        },
        enabled: !!currentPage,
        staleTime: Infinity,    // These links are static, so we can cache them forever.
    });
};