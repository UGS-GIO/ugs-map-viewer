import { useQuery } from "@tanstack/react-query";
import { useGetCurrentPage } from "@/hooks/use-get-current-page";
import { queryKeys } from '@/lib/query-keys';

interface WebsiteInfo {
    references: React.ReactNode;
    acknowledgments: React.ReactNode;
    dataDisclaimer: React.ReactNode;
    mapDetails: React.ReactNode;
    mapDetailsShortened: React.ReactNode;
    dataSources: React.ReactNode;
    dataSourcesShortened: React.ReactNode;
    appTitle: string;
}

/**
 * Fetches page-specific information using TanStack Query for robust
 * caching and state management.
 */
export const useGetPageInfo = () => {
    const currentPage = useGetCurrentPage();

    return useQuery<WebsiteInfo, Error>({
        queryKey: queryKeys.page.info(currentPage),
        queryFn: async () => {
            const module = await import(`@/pages/${currentPage}/data/page-info.tsx`);
            return module
        },
        enabled: !!currentPage,
        staleTime: Infinity,
    });
};