import { useTour, type TourRoute } from '@/lib/tour';
import { linkHasSharedStops } from '@/lib/map/app-history';

interface TourAutoStartProps {
  route?: TourRoute;
}

/**
 * Invisible component that auto-starts the tour for first-time visitors.
 * Place this in your layout to enable automatic tour triggering.
 */
export function TourAutoStart({ route }: TourAutoStartProps) {
  // Someone opening shared stops came for those, not a walkthrough; it's still in the sidebar
  useTour({ route, autoStart: !linkHasSharedStops });
  return null;
}
