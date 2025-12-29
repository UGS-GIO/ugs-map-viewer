import { LayerUrlProvider } from '@/context/layer-url-provider';
import { SidebarProvider } from '@/context/sidebar-provider';
import { MapInstanceProvider } from '@/context/map-instance-context';
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'
import { RouteErrorBoundary } from '@/components/route-error-boundary'

// Get responsive default sidebar width based on screen size
const getDefaultSidebarWidth = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
        return 'narrow' as const;
    }
    return 'wide' as const;
};

const mapSearchSchema = z.object({
    zoom: z.coerce.number().min(0).max(28).optional().default(6),
    lat: z.coerce.number().min(-90).max(90).optional().default(39.57),
    lon: z.coerce.number().min(-180).max(180).optional().default(-110.75),
    filters: z.record(z.string()).optional(),
    tab: z.string().optional().default('info'),
    sidebar_collapsed: z.coerce.boolean().optional().default(false),
    sidebar_width: z.enum(['icon', 'wide', 'narrow']).optional().default(getDefaultSidebarWidth),
    coordinate_format: z.enum(['dd', 'dms']).optional(),
    basemap: z.string().optional(),
    layers: z.preprocess((val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch (e) { return undefined; }
        }
        return val;
    }, z.object({
        selected: z.array(z.string()).optional(),
    }).optional()),
    // Popup query coordinates - allows triggering popup queries via URL
    popup_lat: z.coerce.number().min(-90).max(90).optional(),
    popup_lon: z.coerce.number().min(-180).max(180).optional(),
    // View mode for split/table layout
    view: z.enum(['map', 'split', 'table']).optional(),
    // Click buffer bounds for selection visualization (sw_lng,sw_lat,ne_lng,ne_lat)
    click_bbox: z.string().optional(),
    // Feature geometry bounds for zoom (sw_lng,sw_lat,ne_lng,ne_lat)
    feature_bbox: z.string().optional(),
    // Selected features for sharing (format: layer:id,layer:id,...)
    features: z.string().optional(),
}).strip()

export type MapSearchParams = z.infer<typeof mapSearchSchema>;

export type MapSearch = z.infer<typeof mapSearchSchema>

export const Route = createFileRoute('/_map')({
    validateSearch: mapSearchSchema,
    errorComponent: RouteErrorBoundary,
    component: () => (
        <MapInstanceProvider>
            <LayerUrlProvider>
                <SidebarProvider>
                    <Outlet />
                </SidebarProvider>
            </LayerUrlProvider>
        </MapInstanceProvider>
    ),
})