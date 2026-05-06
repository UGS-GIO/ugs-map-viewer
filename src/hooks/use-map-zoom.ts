import { useEffect, useState } from "react";
import { useMap } from "@/hooks/use-map";

export type ZoomHintDirection = "in" | "out";

/** Returns "in" if zoom below range, "out" if above, null if in range or inputs missing. */
export const getZoomHint = (
    zoom: number | null,
    range: [number, number] | null | undefined,
): ZoomHintDirection | null => {
    if (zoom === null || !range) return null;
    if (zoom < range[0]) return "in";
    if (zoom > range[1]) return "out";
    return null;
};

/** Returns the current map zoom and re-renders on zoom change. */
export const useMapZoom = (): number | null => {
    const { map } = useMap();
    const [zoom, setZoom] = useState<number | null>(map ? map.getZoom() : null);

    useEffect(() => {
        if (!map) return;
        setZoom(map.getZoom());
        const update = () => setZoom(map.getZoom());
        map.on("zoom", update);
        return () => {
            map.off("zoom", update);
        };
    }, [map]);

    return zoom;
};
