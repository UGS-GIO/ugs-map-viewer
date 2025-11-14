import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useMapCoordinates } from '@/hooks/use-map-coordinates';
import { RefObject, useCallback, useMemo } from 'react';
import { ClipboardCopy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { convertDDToDMS } from '@/lib/map/conversion-utils';
import { useMap } from '@/hooks/use-map';
import { clearGraphics } from '@/lib/map/highlight-utils';

interface Props {
    hiddenTriggerRef: RefObject<HTMLDivElement>,
    coordinates: { x: string; y: string }
}

const MapContextMenu = ({ hiddenTriggerRef, coordinates }: Props) => {
    const { isDecimalDegrees } = useMapCoordinates();
    const { map } = useMap();

    // Function to convert coordinates based on current setting
    const formattedCoordinates = useMemo(() => {
        const { x, y } = coordinates;
        return isDecimalDegrees
            ? { x: Number(x).toFixed(3), y: Number(y).toFixed(3) }
            : { x: convertDDToDMS(Number(x), true), y: convertDDToDMS(Number(y)) };
    }, [coordinates, isDecimalDegrees]);

    // Copy coordinates to clipboard
    const handleCopyCoordinates = useCallback(() => {
        const coordsString = `${formattedCoordinates.y}, ${formattedCoordinates.x}`;
        navigator.clipboard.writeText(coordsString);
    }, [formattedCoordinates]);

    // Remove graphics from the map
    const handleRemoveGraphics = useCallback(() => {
        if (map) {
            clearGraphics(map);
        }
    }, [map]);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {/* Hidden div for manually triggering the context menu */}
                <div ref={hiddenTriggerRef} className="hidden" />
            </ContextMenuTrigger>
            <ContextMenuContent onCloseAutoFocus={handleRemoveGraphics}>
                <ContextMenuItem
                    className={cn('px-2 py-1 cursor-pointer')}
                    onSelect={handleCopyCoordinates}
                >
                    Coordinates: {formattedCoordinates.y}, {formattedCoordinates.x}&nbsp;&nbsp;&nbsp;<ClipboardCopy className="h-4 w-4" />
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

export { MapContextMenu };