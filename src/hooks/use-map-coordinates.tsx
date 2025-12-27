import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMapInstance } from '@/context/map-instance-context';
import { convertDDToDMS } from '@/lib/map/conversion-utils';
import type maplibregl from 'maplibre-gl';

const COORD_PRECISION = 3;

const formatCoord = (coord: number | undefined | null): string => {
    const num = Number(coord);
    if (isNaN(num)) return "";
    return num.toFixed(COORD_PRECISION);
};

const convertToDisplayFormat = (x: string, y: string, isDD: boolean, convertDDToDMSFn: typeof convertDDToDMS) => {
    if (!x || !y) return { x: "", y: "" };
    if (isDD) {
        return { x, y };
    } else {
        const dmsX = convertDDToDMSFn(parseFloat(x), true);
        const dmsY = convertDDToDMSFn(parseFloat(y));
        return { x: dmsX, y: dmsY };
    }
};

export function useMapCoordinates() {
    const { map } = useMapInstance();
    const navigate = useNavigate();
    const search = useSearch({ from: '/_map' });
    const isDecimalDegrees = search.coordinate_format !== 'dms';
    const [scale, setScale] = useState<number>(0);
    const [coordinates, setCoordinates] = useState<{ x: string; y: string }>({ x: "", y: "" });
    const lastDecimalCoordinates = useRef<{ x: string; y: string }>({ x: "", y: "" });

    const locationCoordinateFormat = isDecimalDegrees ? "Decimal Degrees" : "Degrees, Minutes, Seconds";

    useEffect(() => {
        const { x, y } = lastDecimalCoordinates.current;
        if (x && y) {
            setCoordinates(convertToDisplayFormat(x, y, isDecimalDegrees, convertDDToDMS));
        }
    }, [isDecimalDegrees]);

    const handleMapLibreChange = useCallback(
        (mapLibreInstance: maplibregl.Map) => {
            const updateFromMapLibre = (mapPoint?: { lng: number; lat: number }) => {
                if (!mapPoint) {
                    const center = mapLibreInstance.getCenter();
                    mapPoint = center;
                }

                // For MapLibre, coordinates are already in geographic WGS84
                lastDecimalCoordinates.current = {
                    x: formatCoord(mapPoint.lng),
                    y: formatCoord(mapPoint.lat),
                };
                setCoordinates(convertToDisplayFormat(
                    lastDecimalCoordinates.current.x,
                    lastDecimalCoordinates.current.y,
                    isDecimalDegrees,
                    convertDDToDMS
                ));

                // Calculate scale from zoom level (approximate)
                const zoomLevel = mapLibreInstance.getZoom();
                const approximateScale = 559192 / Math.pow(2, zoomLevel);
                setScale(Math.round(approximateScale));
            };

            // Update on initial load
            updateFromMapLibre();

            // Update on zoom change
            const handleZoom = () => updateFromMapLibre();
            mapLibreInstance.on('zoom', handleZoom);

            // Update on mouse move (desktop)
            const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
                updateFromMapLibre(e.lngLat);
            };
            mapLibreInstance.on('mousemove', handleMouseMove);

            return () => {
                mapLibreInstance.off('zoom', handleZoom);
                mapLibreInstance.off('mousemove', handleMouseMove);
            };
        },
        [isDecimalDegrees]
    );

    useEffect(() => {
        // Use MapLibre map
        if (map && typeof map.on === 'function' && typeof map.getCenter === 'function') {
            return handleMapLibreChange(map);
        }
    }, [map, handleMapLibreChange]);

    const setCoordinateFormat = useCallback((newIsDecimalDegrees: boolean) => {
        navigate({
            to: ".",
            search: (prev) => ({
                ...prev,
                coordinate_format: newIsDecimalDegrees ? 'dd' : 'dms',
            }),
            replace: true,
        });
    }, [navigate]);

    return {
        isDecimalDegrees,
        setIsDecimalDegrees: setCoordinateFormat,
        coordinates,
        setCoordinates,
        scale,
        locationCoordinateFormat,
    };
}