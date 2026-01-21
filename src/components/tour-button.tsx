import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTour, type TourRoute } from '@/lib/tour';

interface TourButtonProps {
  route?: TourRoute;
  className?: string;
}

export function TourButton({ route, className }: TourButtonProps) {
  const { startTour } = useTour({ route });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={startTour}
            className={className}
            aria-label="Start tour"
          >
            <CircleHelp className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Take a tour</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
