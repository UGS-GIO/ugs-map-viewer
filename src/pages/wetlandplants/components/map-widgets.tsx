import React, { useMemo } from 'react';
import Home from '@arcgis/core/widgets/Home';
import Locate from '@arcgis/core/widgets/Locate';
import useArcGISWidget from '@/hooks/use-arcgis-widget';

const MapWidgets: React.FC = () => {

    const stableWidgets = useMemo(() => [
        { WrappedWidget: Home, position: 'top-left' },
        { WrappedWidget: Locate, position: 'top-left' },
    ], []);

    useArcGISWidget(stableWidgets);

    return null;
};

export { MapWidgets };