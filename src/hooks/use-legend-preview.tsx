import { useQuery } from '@tanstack/react-query';
import { RendererFactory } from '@/lib/legend/renderer-factory';
import { createLegendProvider } from '@/lib/map/legend/factory';
import { useMap } from '@/hooks/use-map';

const useLegendPreview = (layerId: string, url: string) => {
    const { view, map } = useMap();

    const fetchLegendData = async () => {
        if (!view?.map && !map) return [];

        try {
            // Create the appropriate legend provider based on implementation
            const legendProvider = createLegendProvider(view, view?.map, map);

            // Fetch the renderer(s) for the given layer ID
            const renderer = await legendProvider.getRenderer(layerId);

            if (!renderer) {
                console.warn(`Renderer not found for layer ID: ${layerId}`);
                return [];
            }

            const renderers = Array.isArray(renderer) ? renderer : [renderer];

            const previews = await Promise.all(
                renderers.map(async (rendererItem) => {
                    try {
                        const preview = await RendererFactory.createPreview(rendererItem);
                        return preview;
                    } catch (err) {
                        console.error('Error generating preview:', err);
                        return null;
                    }
                })
            );

            // Filter out any failed previews (null values)
            return previews.filter(Boolean);
        } catch (error) {
            console.error('Error fetching legend data:', error);
            return [];
        }
    };

    // Query with dependencies: view, map, layerId, and url (for caching and refetch logic)
    const { data: preview = [], isLoading, error } = useQuery({
        queryKey: ['legendPreview', layerId, url],
        queryFn: fetchLegendData,
        enabled: !!(view?.map || map), // Only run the query when view or map is available
        staleTime: 1000 * 60 * 60 * 1, // Cache for 1 hour
    });

    return { preview, isLoading, error };
};

export default useLegendPreview;