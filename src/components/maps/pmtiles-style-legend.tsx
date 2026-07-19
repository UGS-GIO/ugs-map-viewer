/**
 * Legend derived from a pmtiles layer's own GL style fragment — generic, no per-layer code.
 *
 * ugs-styles publishes each rule's identity on the style layer (`ugs:title` = the SLD rule title,
 * `ugs:rule` = its name), so the swatches are exactly the breaks/classes the map draws with. Any layer
 * whose style carries that metadata gets a legend for free; layers with a bespoke legend register a
 * panel plug-in instead.
 */
import { useQuery } from '@tanstack/react-query';
import type { PMTilesLayerProps } from '@/lib/types/mapping-types';
import { LegendSwatchGrid } from './legend-swatch-grid';
import { activeRenderOf } from './pmtiles-layer-source';

interface StyleLayerLike {
    type?: string;
    paint?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

/** One swatch per distinct styled class, in style order. */
export function legendItemsFromStyle(layers: StyleLayerLike[]): Array<{ key: string; label: string; color: string }> {
    const out: Array<{ key: string; label: string; color: string }> = [];
    const seen = new Set<string>();
    for (const l of layers) {
        const paint = l.paint ?? {};
        const color = paint['fill-color'] ?? paint['line-color'] ?? paint['circle-color'];
        if (typeof color !== 'string') continue;
        const meta = l.metadata ?? {};
        const title = typeof meta['ugs:title'] === 'string' ? (meta['ugs:title'] as string) : '';
        const rule = typeof meta['ugs:rule'] === 'string' ? (meta['ugs:rule'] as string) : '';
        // Without a rule title there's nothing meaningful to label a swatch with — skip rather than
        // invent one (a legend of unlabeled colors is worse than none).
        if (!title) continue;
        const key = rule || title;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ key, label: title, color });
    }
    return out;
}

/** Generic legend for a pmtiles layer, fetched from its active render's style. Renders nothing when the
 *  style has no rule metadata (e.g. a single unclassified fill). */
export function PMTilesStyleLegend({ layer }: { layer: PMTilesLayerProps }) {
    const render = activeRenderOf(layer);
    const styleUrl = render?.styleUrl;
    // A render can declare its legend outright (ugs-styles publishes one for icon renders, where colors
    // live in a sprite and can't be read off the paint). Prefer that; only parse the style when absent.
    const declared = render?.legend;
    const { data: derived = [] } = useQuery({
        queryKey: ['pmtiles-style-legend', styleUrl ?? ''],
        queryFn: async () => {
            const res = await fetch(styleUrl!);
            if (!res.ok) return [];
            const style = await res.json();
            return legendItemsFromStyle(style.layers ?? []);
        },
        enabled: !!styleUrl && !declared?.length,
        staleTime: Infinity,
    });

    const items = declared?.length
        ? declared.map((l) => ({ key: l.label, label: l.label, color: l.color }))
        : derived;
    if (items.length === 0) return null;
    return (
        <div className="p-2">
            <LegendSwatchGrid items={items} columns="single" />
        </div>
    );
}
