import { Button } from '@/components/ui/button';
import { useMultiSelect } from '@/context/multi-select-context';
import { Box, X, Check } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/custom/tooltip';

interface MultiSelectToolProps {
    onComplete?: () => void;
    onCancel?: () => void;
}

export function MultiSelectTool({ onComplete, onCancel }: MultiSelectToolProps) {
    const { isMultiSelectMode, setMultiSelectMode, isDrawing, hasCompletedPolygon } = useMultiSelect();

    const handleToggle = () => {
        if (isMultiSelectMode) {
            setMultiSelectMode(false);
            onCancel?.();
        } else {
            setMultiSelectMode(true);
        }
    };

    const handleCancel = () => {
        setMultiSelectMode(false);
        onCancel?.();
    };

    const handleComplete = () => {
        onComplete?.();
    };

    const getButtonText = () => {
        if (!isMultiSelectMode) return 'Multi-Select';
        if (hasCompletedPolygon) return 'Selection Complete';
        if (isDrawing) return 'Drawing...';
        return 'Draw Polygon';
    };

    return (
        <div className="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={isMultiSelectMode ? 'default' : 'outline'}
                            size="sm"
                            onClick={handleToggle}
                            className="gap-2"
                        >
                            <Box className="h-4 w-4" />
                            {getButtonText()}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>
                            {isMultiSelectMode
                                ? 'Click to draw a polygon on the map to select features'
                                : 'Enable multi-select mode to query multiple features'}
                        </p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {isMultiSelectMode && (
                <>
                    {isDrawing && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleComplete}
                                        className="gap-2"
                                    >
                                        <Check className="h-4 w-4" />
                                        Complete
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Complete the polygon and query features</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancel}
                                    className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                >
                                    <X className="h-4 w-4" />
                                    Cancel
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Exit multi-select mode</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </>
            )}
        </div>
    );
}
