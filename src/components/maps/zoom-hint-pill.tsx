import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ZoomHintDirection } from "@/hooks/use-map-zoom";

interface ZoomHintPillProps {
    direction: ZoomHintDirection;
    range: [number, number];
    /** When set, the zoom-out hint names this 1:X scale instead of a zoom level. */
    maxScale?: number;
    onClick: () => void;
}

const oneDecimal = (zoom: number, round: (n: number) => number) => Number((round(zoom * 10) / 10).toFixed(1));

export const ZoomHintPill = ({ direction, range, maxScale, onClick }: ZoomHintPillProps) => {
    const Icon = direction === "in" ? ZoomIn : ZoomOut;
    const tooltip =
        direction === "in"
            ? `Visible at zoom ${oneDecimal(range[0], Math.ceil)} and closer. Click to zoom in.`
            : maxScale
              ? `Visible at 1:${maxScale.toLocaleString("en-US")} and farther out. Click to zoom out.`
              : `Visible at zoom ${oneDecimal(range[1], Math.floor)} and farther out. Click to zoom out.`;

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full h-auto py-0.5 px-2 text-xs text-muted-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <Icon className="h-3 w-3" />
                        <span>Zoom {direction} to see</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
