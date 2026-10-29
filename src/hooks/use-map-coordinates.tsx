import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMapInstance } from '@/context/map-instance-context';
import type { CoordinateFormat } from '@/lib/map/conversion-utils';
import { metersPerPixelAtCenter, scaleDenominator } from '@/lib/map/map-scale';
import type * as maplibregl from 'maplibre-gl';

export function useCoordinateFormat() {
    const navigate = useNavigate();
    const coordinateFormat = useSearch({ from: '/_map', select: (s) => s.coordinate_format ?? 'dd' });

    const setCoordinateFormat = useCallback((format: CoordinateFormat) => {
        navigate({
            to: ".",
            search: (prev) => ({ ...prev, coordinate_format: format }),
            replace: true,
        });
    }, [navigate]);

    return { coordinateFormat, setCoordinateFormat };
}

export function useMapCoordinates() {
    const { map } = useMapInstance();
    const [scale, setScale] = useState<number>(0);
    const [lngLat, setLngLat] = useState<{ lng: number; lat: number } | null>(null);

    useEffect(() => {
        if (!map) return;

        const updateFromMapLibre = (mapPoint?: { lng: number; lat: number }) => {
            const { lng, lat } = mapPoint ?? map.getCenter();
            setLngLat({ lng, lat });
            setScale(Math.round(scaleDenominator(metersPerPixelAtCenter(map))));
        };

        // Update on initial load
        updateFromMapLibre();

        // Throttle zoom updates to one per animation frame - the 'zoom' event
        // fires ~60fps during zoom animations, and each setState call triggers
        // a React re-render of the footer. RAF batches these to at most 1/frame.
        let zoomRaf: number | null = null;
        const handleZoom = () => {
            if (zoomRaf) cancelAnimationFrame(zoomRaf);
            zoomRaf = requestAnimationFrame(() => updateFromMapLibre());
        };
        map.on('zoom', handleZoom);

        // The scale depends on the center latitude and the canvas size, so refresh
        // it after any pan (keyboard, fly-to, zoom-to), on resize, and once the first
        // frame has rendered (the canvas can still be 0px wide at mount), without
        // touching the cursor readout.
        const handleMoveEnd = () => {
            setScale(Math.round(scaleDenominator(metersPerPixelAtCenter(map))));
        };
        map.on('moveend', handleMoveEnd);
        map.on('resize', handleMoveEnd);
        map.once('idle', handleMoveEnd);

        // Throttle mousemove the same way - fires on every pixel of movement
        let moveRaf: number | null = null;
        const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
            if (moveRaf) cancelAnimationFrame(moveRaf);
            moveRaf = requestAnimationFrame(() => updateFromMapLibre(e.lngLat));
        };
        map.on('mousemove', handleMouseMove);

        return () => {
            map.off('zoom', handleZoom);
            map.off('moveend', handleMoveEnd);
            map.off('resize', handleMoveEnd);
            map.off('idle', handleMoveEnd);
            map.off('mousemove', handleMouseMove);
            if (zoomRaf) cancelAnimationFrame(zoomRaf);
            if (moveRaf) cancelAnimationFrame(moveRaf);
        };
    }, [map]);

    return { lngLat, scale };
}
