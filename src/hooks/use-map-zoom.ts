import { useEffect, useState } from "react";
import { useMap } from "@/hooks/use-map";

export type ZoomHintDirection = "in" | "out";

/** Returns "in" if zoom below range, "out" if at or above maxzoom (exclusive, as in MapLibre), null if in range or inputs missing. */
export const getZoomHint = (
    zoom: number | null,
    range: [number, number] | null | undefined,
): ZoomHintDirection | null => {
    if (zoom === null || !range) return null;
    if (zoom < range[0]) return "in";
    if (zoom >= range[1]) return "out";
    return null;
};

/** Returns the view center's latitude, updated when the map stops moving. */
export const useMapLatitude = (): number | null => {
    const { map } = useMap();
    const [latitude, setLatitude] = useState<number | null>(map ? map.getCenter().lat : null);

    useEffect(() => {
        if (!map) return;
        setLatitude(map.getCenter().lat);
        const update = () => setLatitude(map.getCenter().lat);
        map.on("moveend", update);
        return () => {
            map.off("moveend", update);
        };
    }, [map]);

    return latitude;
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
