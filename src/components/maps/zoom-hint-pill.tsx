import { useId } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ZoomHintDirection } from "@/hooks/use-map-zoom";

interface ZoomHintPillProps {
    direction: ZoomHintDirection;
    range: [number, number];
    /** When set, the zoom-out hint names this 1:X scale instead of a zoom level. */
    maxScale?: number;
    /** Layer title, for the button's accessible name. */
    layerTitle?: string;
    onClick: () => void;
}

const oneDecimal = (zoom: number, round: (n: number) => number) => Number((round(zoom * 10) / 10).toFixed(1));

export const ZoomHintPill = ({ direction, range, maxScale, layerTitle, onClick }: ZoomHintPillProps) => {
    const Icon = direction === "in" ? ZoomIn : ZoomOut;
    const detailId = useId();
    const detail =
        direction === "in"
            ? `Visible at zoom ${oneDecimal(range[0], Math.ceil)} and closer.`
            : maxScale
              ? `Visible at 1:${maxScale.toLocaleString("en-US")} and farther out.`
              : `Visible at zoom ${oneDecimal(range[1], Math.floor)} and farther out.`;

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 rounded-full border-primary px-2.5 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
                        aria-label={`Zoom ${direction} to see ${layerTitle ?? "this layer"}`}
                        aria-describedby={detailId}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        Zoom {direction}
                        <span id={detailId} className="sr-only">{detail}</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{detail} Click to zoom {direction}.</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
