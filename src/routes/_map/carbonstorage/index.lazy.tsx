import { createLazyFileRoute } from '@tanstack/react-router';
import { RouteErrorBoundary } from '@/components/route-error-boundary';
import Map from '@/pages/carbonstorage';

export const Route = createLazyFileRoute('/_map/carbonstorage/')({
    errorComponent: RouteErrorBoundary,
    component: () => <Map />,
});