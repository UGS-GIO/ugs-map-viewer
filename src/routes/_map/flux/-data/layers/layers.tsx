import { LayerProps, PMTilesLayerProps } from "@/lib/types/mapping-types";

// Utah Flux Network stations, from the app's station feed via the warehouse.
// TODO: confirm the STAC item id once the warehouse publishes the stations topic.
const fluxStationsLayerName = 'flux_stations';
export const fluxStationsTitle = 'Flux Stations';
const fluxStationsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: fluxStationsLayerName,
    pmtilesUrl: '',
    sourceLayer: fluxStationsLayerName,
    title: fluxStationsTitle,
    visible: true,
    sourceAgency: 'Utah Geological Survey',
    opacity: 1,
    sublayers: [
        {
            name: fluxStationsLayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Site ID': { field: 'site_id', type: 'string' },
                'Name': { field: 'name', type: 'string' },
                'Ecosystem': { field: 'ecosystem', type: 'string' },
                'AmeriFlux ID': { field: 'ameriflux_id', type: 'string' },
                'Timezone': { field: 'timezone', type: 'string' },
            },
        },
    ],
};

const layersConfig: LayerProps[] = [
    fluxStationsConfig,
];

export default layersConfig;
