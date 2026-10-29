import React from 'react';
import { CoordinateFormatCard } from '@/components/sidebar/coordinate-format-card';
import { TerrainCard } from '@/components/sidebar/terrain-card';
import { BasemapBlendCard } from '@/components/sidebar/basemap-blend-card';

function MapConfigurations() {
    return (
        <div className='space-y-2'>
            <div className="mb-4">
                <h2 className="text-lg font-medium mb-2">Map Configurations</h2>
            </div>
            <CoordinateFormatCard />
            <TerrainCard />
            <BasemapBlendCard />
        </div>
    );
}

export default React.memo(MapConfigurations);
