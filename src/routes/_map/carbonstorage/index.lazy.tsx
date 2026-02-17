import { createLazyFileRoute } from '@tanstack/react-router';
import { RouteErrorBoundary } from '@/components/route-error-boundary';
import Map from './-index';

export const Route = createLazyFileRoute('/_map/carbonstorage/')({
    errorComponent: RouteErrorBoundary,
    component: () => <Map />,
});