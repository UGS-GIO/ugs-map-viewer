import { useQuery } from "@tanstack/react-query";
import { XMLParser } from "fast-xml-parser";
import { PMTiles } from "pmtiles";
import { queryKeys } from '@/lib/query-keys';

export type BoundingBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

interface WMSLayer {
    Name?: string;
    Layer?: WMSLayer | WMSLayer[];
    BoundingBox?: WMSBoundingBox | WMSBoundingBox[];
    EX_GeographicBoundingBox?: {
        westBoundLongitude: string;
        southBoundLatitude: string;
        eastBoundLongitude: string;
        northBoundLatitude: string;
    };
}

interface WMSBoundingBox {
    '@_CRS'?: string;
    '@_minx': string;
    '@_miny': string;
    '@_maxx': string;
    '@_maxy': string;
}

const parseCapabilitiesExtent = (xml: string, targetLayerName: string): BoundingBox | null => {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
    });

    try {
        const parsed = parser.parse(xml);
        const capability = parsed.WMS_Capabilities?.Capability ||
            parsed.WMT_MS_Capabilities?.Capability;

        if (!capability?.Layer) return null;

        // Helper function to find layer by name
        const findLayerByName = (layer: WMSLayer, name: string): WMSLayer | null => {
            if (layer.Name === name) return layer;
            if (layer.Layer) {
                if (Array.isArray(layer.Layer)) {
                    for (const sublayer of layer.Layer) {
                        const found = findLayerByName(sublayer, name);
                        if (found) return found;
                    }
                } else {
                    return findLayerByName(layer.Layer, name);
                }
            }
            return null;
        };

        const targetLayer = findLayerByName(capability.Layer, targetLayerName);

        if (!targetLayer) return null;

        // Try WMS 1.3.0 BoundingBox
        if (targetLayer.BoundingBox) {
            const bbox = Array.isArray(targetLayer.BoundingBox)
                ? targetLayer.BoundingBox.find((box: any) =>
                    box['@_CRS'] === 'EPSG:4326' || box['@_CRS'] === 'CRS:84')
                : targetLayer.BoundingBox;

            if (bbox) {
                return [
                    parseFloat(bbox['@_minx']),
                    parseFloat(bbox['@_miny']),
                    parseFloat(bbox['@_maxx']),
                    parseFloat(bbox['@_maxy'])
                ];
            }
        }

        // Try WMS 1.3.0 EX_GeographicBoundingBox
        if (targetLayer.EX_GeographicBoundingBox) {
            const bbox = targetLayer.EX_GeographicBoundingBox;
            return [
                parseFloat(bbox.westBoundLongitude),
                parseFloat(bbox.southBoundLatitude),
                parseFloat(bbox.eastBoundLongitude),
                parseFloat(bbox.northBoundLatitude)
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

interface WMSExtentOptions {
    type: 'wms';
    wmsUrl: string | null;
    layerName: string | null;
}

interface PMTilesExtentOptions {
    type: 'pmtiles';
    pmtilesUrl: string;
}

type UseLayerExtentOptions = WMSExtentOptions | PMTilesExtentOptions;

const useLayerExtent = (options: UseLayerExtentOptions) => {
    const queryKey = options.type === 'pmtiles'
        ? queryKeys.layers.extent('pmtiles', options.pmtilesUrl)
        : queryKeys.layers.extent(options.wmsUrl || '', options.layerName || '');

    const queryFn = options.type === 'pmtiles'
        ? () => fetchPMTilesExtent(options.pmtilesUrl)
        : () => fetchLayerExtent(options.wmsUrl || '', options.layerName || '');

    return useQuery({
        queryKey,
        queryFn,
        enabled: false,
        staleTime: Infinity,
    });
};

export { useLayerExtent };
export type { UseLayerExtentOptions };