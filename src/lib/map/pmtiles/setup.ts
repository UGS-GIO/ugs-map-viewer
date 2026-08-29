import maplibregl from 'maplibre-gl';
import { Protocol, PMTiles, FileSource } from 'pmtiles';

// Kept at module scope (not just registered and dropped) so local, File-backed
// archives can be added to it after startup — see `registerLocalPMTiles`.
let protocol: Protocol | null = null;

/**
 * Initialize PMTiles protocol for MapLibre
 * Only needs to be called once per app lifecycle
 */
export function setupPMTilesProtocol(): void {
    if (protocol) {
        return;
    }

    protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
}

/**
 * Register a PMTiles archive backed by a local `File` so it can render without a
 * server. `FileSource` satisfies the same `Source` contract as the HTTP fetcher
 * by answering byte ranges with `Blob.slice()` — no network involved.
 *
 * The protocol keys instances by `source.getKey()`, which for a `FileSource` is
 * the file NAME. So a style referencing `pmtiles://<file.name>` resolves to this
 * instance instead of being fetched as a URL. This is the same approach the
 * Protomaps viewer (pmtiles.io) uses for drag-and-dropped archives.
 *
 * Registration MUST happen before the layer renders: on a cache miss the
 * protocol would construct a PMTiles from the key as if it were a URL, and
 * request a file that doesn't exist.
 */
export function registerLocalPMTiles(file: File): PMTiles {
    setupPMTilesProtocol();
    const archive = new PMTiles(new FileSource(file));
    protocol!.add(archive);
    return archive;
}

/** The registered archive for a local key (file name), if any. */
export function getLocalPMTiles(key: string): PMTiles | undefined {
    return protocol?.get(key);
}
