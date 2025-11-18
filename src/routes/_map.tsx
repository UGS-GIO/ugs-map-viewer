import { LayerUrlProvider } from '@/context/layer-url-provider';
import { MapProvider } from '@/context/map-provider';
import { SidebarProvider } from '@/context/sidebar-provider';
import { MultiSelectProvider } from '@/context/multi-select-context';
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'
import { RouteErrorBoundary } from '@/components/route-error-boundary'

const mapSearchSchema = z.object({
    zoom: z.coerce.number().min(0).max(28).optional().default(7),
    lat: z.coerce.number().min(-90).max(90).optional().default(39.5),
    lon: z.coerce.number().min(-180).max(180).optional().default(-112),
    filters: z.record(z.string()).optional(),
    tab: z.string().optional().default('info'),
    sidebar_collapsed: z.coerce.boolean().optional().default(false),
    sidebar_width: z.enum(['icon', 'medium', 'wide']).optional().default('wide'),
    coordinate_format: z.enum(['dd', 'dms']).optional(),
    basemap: z.string().optional(),
    layers: z.preprocess((val) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch (e) { return undefined; }
        }
        return val;
    }, z.object({
        selected: z.array(z.string()).optional(),
        hidden: z.array(z.string()).optional(),
    }).optional())
}).strip()

export type MapSearchParams = z.infer<typeof mapSearchSchema>;

export type MapSearch = z.infer<typeof mapSearchSchema>

export const Route = createFileRoute('/_map')({
    validateSearch: mapSearchSchema,
    errorComponent: RouteErrorBoundary,
    component: () => (
        <LayerUrlProvider>
            <SidebarProvider>
                <MapProvider>
                    <MultiSelectProvider>
                        <Outlet />
                    </MultiSelectProvider>
                </MapProvider>
            </SidebarProvider>
        </LayerUrlProvider>
    ),
})