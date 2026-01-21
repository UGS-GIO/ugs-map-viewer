import { useTour, type TourRoute } from '@/lib/tour';

interface TourAutoStartProps {
  route?: TourRoute;
}

/**
 * Invisible component that auto-starts the tour for first-time visitors.
 * Place this in your layout to enable automatic tour triggering.
 */
export function TourAutoStart({ route }: TourAutoStartProps) {
  useTour({ route, autoStart: true });
  return null;
}
