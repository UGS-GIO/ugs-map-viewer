import { createLazyFileRoute } from '@tanstack/react-router';
import { RouteErrorBoundary } from '@/components/route-error-boundary';
import Map from '@/pages/hazards';

export const Route = createLazyFileRoute('/_map/hazards/')({
  errorComponent: RouteErrorBoundary,
  component: () => <Map />,
});