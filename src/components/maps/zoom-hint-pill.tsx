import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ZoomHintDirection } from "@/hooks/use-map-zoom";

interface ZoomHintPillProps {
    direction: ZoomHintDirection;
    range: [number, number];
    onClick: () => void;
}

export const ZoomHintPill = ({ direction, range, onClick }: ZoomHintPillProps) => {
    const Icon = direction === "in" ? ZoomIn : ZoomOut;
    const tooltip =
        direction === "in"
            ? `Visible at zoom ≥ ${Math.round(range[0])} — click to zoom in`
            : `Visible at zoom ≤ ${Math.round(range[1])} — click to zoom out`;

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
