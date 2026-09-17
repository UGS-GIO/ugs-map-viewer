import maplibregl from 'maplibre-gl';
import { cogProtocol } from '@geomatico/maplibre-cog-protocol';
import type { COGLayerProps } from '@/lib/types/mapping-types';

let protocolAdded = false;

/** Register cog:// protocol once per app lifecycle. */
export function setupCOGProtocol(): void {
    if (protocolAdded) return;
    maplibregl.addProtocol('cog', cogProtocol);
    protocolAdded = true;
}

/**
 * Build a `cog://` source URL with the lib's color hash spec.
 * Hash format: `#color:[hex,...],min,max,modifiers`
 * Modifiers: `c` = continuous interpolation, `-` = reverse colormap.
 * No range (an RGB scan) means no hash: the protocol then draws the image's own bands.
 */
export function buildCogProtocolUrl(layer: COGLayerProps, range: [number, number] | undefined): string {
    if (!range) return `cog://${layer.cogUrl}`;
    const colorsJson = JSON.stringify(layer.colorStops);
    const continuous = layer.continuous === false ? '' : 'c';
    const reverse = layer.reverse ? '-' : '';
    const modifiers = `${continuous}${reverse}`;
    const tail = modifiers ? `,${modifiers}` : '';
    return `cog://${layer.cogUrl}#color:${colorsJson},${range[0]},${range[1]}${tail}`;
}

/** Highlight colors used to visually link map shapes (buffer / pixel) with popup item swatches. */
export const HIGHLIGHT_COLORS = {
    /** COG pixel cell highlight (amber) — emphasised because it marks the actual sampled data cell. */
    cog: '#fbbf24',
    /** Vector click buffer outline (neutral) — secondary, just shows the search radius. */
    vector: '#525252',
} as const;
