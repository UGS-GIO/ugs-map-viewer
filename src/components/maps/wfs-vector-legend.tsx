import { useSearch } from '@tanstack/react-router';
import type { WFSLayerProps } from '@/lib/types/mapping-types';

/**
 * Renders a legend for a client-side WFS vector layer. The legend's content
 * tracks the active symbology mode stored on the route's `vector_symbology`
 * search param. When the mode matches the layer's `iconSymbologyKey`, the
 * `pieGlyphLegend` swatches are shown; otherwise falls back to the
 * `circleColorMatch` swatches. Row shape matches the WMS legend (see
 * `legend-accordion.tsx`'s `LegendItem`).
 */
function LegendRow({ color, label, strokeColor }: { color: string; label: string; strokeColor?: string }) {
    // Match WMS legend SVG dimensions (SYMBOL_CONSTANTS.SVG_WIDTH/HEIGHT) and point size
    // so WFS swatches render at the same visual size as WMS ones in the legend list.
    return (
        <div className="flex items-center space-x-2 py-1">
            <span className="flex items-center justify-center w-8 min-w-8" aria-hidden>
                <svg width="32" height="20" viewBox="0 0 32 20">
                    <circle
                        cx="16"
                        cy="10"
                        r="5"
                        fill={color}
                        // Ink from the swatch palette, not pure black: these sit on the panel, which
                        // is dark half the time.
                        stroke={strokeColor ?? '#333333'}
                        strokeWidth="1"
                    />
                </svg>
            </span>
            <span>{label}</span>
        </div>
    );
}

export function WfsVectorLegend({ layer }: { layer: WFSLayerProps }) {
    const search = useSearch({ strict: false });
    const symbology = search.vector_symbology;
    let activeMode = '';
    if (symbology && typeof symbology === 'object' && !Array.isArray(symbology) && layer.title in symbology) {
        const v = Reflect.get(symbology, layer.title);
        if (typeof v === 'string') activeMode = v;
    }

    const style = layer.style;
    if (!style) return null;

    const pieKey = style.iconSymbologyKey;
    const pie = style.pieGlyphLegend;
    const categorical = style.circleColorMatch;
    const strokes = style.circleStrokeColorMatch;

    if (pieKey && pie && activeMode === pieKey) {
        return <>{pie.codes.map(code => <LegendRow key={code} color={pie.colors[code]} label={code} />)}</>;
    }

    if (categorical) {
        return (
            <>
                {Object.entries(categorical.matches).map(([label, color]) => (
                    <LegendRow key={label} color={color} label={label} strokeColor={strokes?.matches[label]} />
                ))}
            </>
        );
    }

    return null;
}
