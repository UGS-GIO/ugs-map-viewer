import { useQuery } from "@tanstack/react-query";
import { PMTiles } from "pmtiles";
import { queryKeys } from '@/lib/query-keys';
import { convertBbox } from '@/lib/map/conversion-utils';

export type BoundingBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

const directChildren = (el: Element, name: string): Element[] =>
    Array.from(el.children).filter((child) => child.localName === name);

const directChildText = (el: Element, name: string): string | null =>
    directChildren(el, name)[0]?.textContent?.trim() ?? null;

export const parseCapabilitiesExtent = (xml: string, targetLayerName: string): BoundingBox | null => {
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.querySelector('parsererror')) {
            console.error('Error parsing GetCapabilities response: malformed XML');
            return null;
        }

        // Root is WMS_Capabilities (1.3.0) or WMT_MS_Capabilities (1.1.1)
        const capability = directChildren(doc.documentElement, 'Capability')[0];
        const rootLayer = capability && directChildren(capability, 'Layer')[0];
        if (!rootLayer) return null;

        const findLayerByName = (layer: Element, name: string): Element | null => {
            if (directChildText(layer, 'Name') === name) return layer;
            for (const sublayer of directChildren(layer, 'Layer')) {
                const found = findLayerByName(sublayer, name);
                if (found) return found;
            }
            return null;
        };

        const targetLayer = findLayerByName(rootLayer, targetLayerName);
        if (!targetLayer) return null;

        // Try WMS 1.3.0 BoundingBox
        // IMPORTANT: Prefer CRS:84 over EPSG:4326 because WMS 1.3.0 uses lat/lon axis order
        // for EPSG:4326, while CRS:84 always uses lon/lat order
        const boxes = directChildren(targetLayer, 'BoundingBox');

        // First try CRS:84 (always lon/lat order)
        const crs84Box = boxes.find((box) => box.getAttribute('CRS') === 'CRS:84');
        if (crs84Box) {
            return [
                parseFloat(crs84Box.getAttribute('minx')!),
                parseFloat(crs84Box.getAttribute('miny')!),
                parseFloat(crs84Box.getAttribute('maxx')!),
                parseFloat(crs84Box.getAttribute('maxy')!)
            ];
        }

        // Fall back to EPSG:4326 but swap axes (WMS 1.3.0 uses lat/lon for 4326)
        const epsg4326Box = boxes.find((box) => box.getAttribute('CRS') === 'EPSG:4326');
        if (epsg4326Box) {
            // minx/maxx are lat, miny/maxy are lon in WMS 1.3.0 EPSG:4326
            return [
                parseFloat(epsg4326Box.getAttribute('miny')!), // lon
                parseFloat(epsg4326Box.getAttribute('minx')!), // lat
                parseFloat(epsg4326Box.getAttribute('maxy')!), // lon
                parseFloat(epsg4326Box.getAttribute('maxx')!)  // lat
            ];
        }

        // Try WMS 1.3.0 EX_GeographicBoundingBox
        const exBox = directChildren(targetLayer, 'EX_GeographicBoundingBox')[0];
        if (exBox) {
            return [
                parseFloat(directChildText(exBox, 'westBoundLongitude')!),
                parseFloat(directChildText(exBox, 'southBoundLatitude')!),
                parseFloat(directChildText(exBox, 'eastBoundLongitude')!),
                parseFloat(directChildText(exBox, 'northBoundLatitude')!)
            ];
        }

        return null;
    } catch (error) {
        console.error('Error parsing GetCapabilities response:', error);
        return null;
    }
};

const fetchLayerExtent = async (wmsUrl: string, layerName: string): Promise<BoundingBox | null> => {
    if (!wmsUrl || !layerName) {
        return null;
    }

    // Extract namespace from layerName (format: "namespace:layerName")
    const [namespace] = layerName.split(':');

    // Construct GetCapabilities URL with version (1.3.0 is most current)
    const capabilitiesUrl = new URL(wmsUrl);
    capabilitiesUrl.searchParams.set('service', 'WMS');
    capabilitiesUrl.searchParams.set('version', '1.3.0');
    capabilitiesUrl.searchParams.set('request', 'GetCapabilities');

    if (namespace) {
        capabilitiesUrl.searchParams.set('namespace', namespace);
    }

    try {
        const response = await fetch(capabilitiesUrl.toString());

        if (!response.ok) {
            throw new Error(`Failed to fetch capabilities: ${response.statusText}`);
        }

        const xml = await response.text();
        const extent = parseCapabilitiesExtent(xml, layerName);
        return extent;
    } catch (error) {
        console.error('Error fetching WMS capabilities:', error);
        return null;
    }
};

/**
 * Fetch extent from a PMTiles file header
 * PMTiles files contain bounds metadata written by tippecanoe
 */
const fetchPMTilesExtent = async (pmtilesUrl: string): Promise<BoundingBox | null> => {
    if (!pmtilesUrl) {
        return null;
    }

    try {
        // Convert relative URL to absolute
        const absoluteUrl = pmtilesUrl.startsWith('http')
            ? pmtilesUrl
            : `${window.location.origin}${pmtilesUrl}`;

        const pmtiles = new PMTiles(absoluteUrl);
        const header = await pmtiles.getHeader();

        // PMTiles header contains bounds in [minLon, minLat, maxLon, maxLat] format
        if (header.minLon !== undefined && header.minLat !== undefined &&
            header.maxLon !== undefined && header.maxLat !== undefined) {
            return [header.minLon, header.minLat, header.maxLon, header.maxLat];
        }

        return null;
    } catch (error) {
        console.error('Error fetching PMTiles extent:', error);
        return null;
    }
};

const ESRI_WKID_MAP: Record<number, string> = {
    102100: 'EPSG:3857',
    3857: 'EPSG:3857',
    4326: 'EPSG:4326',
}

function wkidToEpsg(wkid?: number): string {
    if (wkid && wkid in ESRI_WKID_MAP) return ESRI_WKID_MAP[wkid]
    return wkid ? `EPSG:${wkid}` : 'EPSG:4326'
}

/**
 * Fetch extent from an ArcGIS MapServer service JSON
 */
const fetchArcGisExtent = async (mapServerUrl: string): Promise<BoundingBox | null> => {
    if (!mapServerUrl) return null;

    try {
        const response = await fetch(`${mapServerUrl}?f=pjson`);
        if (!response.ok) {
            throw new Error(`Failed to fetch ArcGIS service info: ${response.statusText}`);
        }

        const json = await response.json();
        const ext = json.fullExtent;
        if (!ext || ext.xmin == null) return null;

        const wkid = ext.spatialReference?.wkid ?? ext.spatialReference?.latestWkid;
        const epsg = wkidToEpsg(wkid);

        const rawBbox = [ext.xmin, ext.ymin, ext.xmax, ext.ymax];
        const [minLng, minLat, maxLng, maxLat] = convertBbox(rawBbox, epsg);
        return [minLng, minLat, maxLng, maxLat];
    } catch (error) {
        console.error('Error fetching ArcGIS extent:', error);
        return null;
    }
};

interface WMSExtentOptions {
    type: 'wms';
    wmsUrl: string | null;
    layerName: string | null;
}

interface PMTilesExtentOptions {
    type: 'pmtiles';
    pmtilesUrl: string;
}

interface ArcGISExtentOptions {
    type: 'arcgis';
    mapServerUrl: string;
}

type UseLayerExtentOptions = WMSExtentOptions | PMTilesExtentOptions | ArcGISExtentOptions;

function getExtentQuery(options: UseLayerExtentOptions) {
    switch (options.type) {
        case 'pmtiles':
            return {
                queryKey: queryKeys.layers.extent('pmtiles', options.pmtilesUrl),
                queryFn: () => fetchPMTilesExtent(options.pmtilesUrl),
            }
        case 'arcgis':
            return {
                queryKey: queryKeys.layers.extent('arcgis', options.mapServerUrl),
                queryFn: () => fetchArcGisExtent(options.mapServerUrl),
            }
        case 'wms':
            return {
                queryKey: queryKeys.layers.extent(options.wmsUrl || '', options.layerName || ''),
                queryFn: () => fetchLayerExtent(options.wmsUrl || '', options.layerName || ''),
            }
    }
}

const useLayerExtent = (options: UseLayerExtentOptions) => {
    const { queryKey, queryFn } = getExtentQuery(options)

    return useQuery({
        queryKey,
        queryFn,
        enabled: false,
        staleTime: Infinity,
    });
};

export { useLayerExtent };
export type { UseLayerExtentOptions };