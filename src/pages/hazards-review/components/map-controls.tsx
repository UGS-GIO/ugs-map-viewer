import React from 'react';
import { useMap } from '@/hooks/use-map';
import { useMapControls } from '@/hooks/use-map-controls';
import { DEFAULT_MAP_CONTROLS } from '@/lib/map/controls/default-controls';

const MapControls: React.FC = () => {
    const { map } = useMap();
    useMapControls(map, DEFAULT_MAP_CONTROLS);

    return null;
};

export { MapControls };