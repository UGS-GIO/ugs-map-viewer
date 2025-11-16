import { useQuery } from "@tanstack/react-query";
import { XMLParser } from "fast-xml-parser";
import { queryKeys } from '@/lib/query-keys';

export type BoundingBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

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
        const findLayerByName = (layer: any, name: string): any => {
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

const useLayerExtent = (wmsUrl: string | null, layerName: string | null) => {
    return useQuery({
        queryKey: queryKeys.layers.extent(wmsUrl || '', layerName || ''),
        queryFn: () => fetchLayerExtent(wmsUrl || '', layerName || ''),
        enabled: false, // Only fetch when explicitly called via refetch()
        staleTime: Infinity, // Keeps the data fresh forever (never marks as stale)
    });
};

export { useLayerExtent };