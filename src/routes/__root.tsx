import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { createRootRoute, Outlet, useSearch } from '@tanstack/react-router';
import { z } from 'zod';
import { RouteErrorBoundary } from '@/components/route-error-boundary';

const RootComponent = () => {
    // Local dev only, and never over a presentation; preview builds are shown to people outside the team
    const presenting = useSearch({ strict: false, select: (search) => search.present !== undefined });
    return (
        <>
            <Outlet />
            {import.meta.env.DEV && !presenting && <TanStackRouterDevtools />}
        </>
    );
};

const rootSearchSchema = z.object({});

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: RouteErrorBoundary,
    validateSearch: rootSearchSchema,
});