import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

let protocolAdded = false;

/**
 * Initialize PMTiles protocol for MapLibre
 * Only needs to be called once per app lifecycle
 */
export function setupPMTilesProtocol(): void {
    if (protocolAdded) {
        return;
    }

    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    protocolAdded = true;
}
