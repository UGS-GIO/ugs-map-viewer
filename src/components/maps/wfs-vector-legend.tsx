import { useSearch } from '@tanstack/react-router';
import type { WFSLayerProps } from '@/lib/types/mapping-types';
import { LegendSwatch } from '@/components/maps/legend-swatch-grid';
import { LEGEND_ROW_CLASS } from '@/lib/legend/legend-layout';

/**
 * Renders a legend for a client-side WFS vector layer. The legend's content
 * tracks the active symbology mode stored on the route's `vector_symbology`
 * search param. When the mode matches the layer's `iconSymbologyKey`, the
 * `pieGlyphLegend` swatches are shown; otherwise falls back to the
 * `circleColorMatch` swatches.
 */
function LegendRow({ color, label, strokeColor }: { color: string; label: string; strokeColor?: string }) {
    return (
        <div className={LEGEND_ROW_CLASS}>
            {/* Ink from the swatch palette, not pure black: these sit on the panel, which is dark half the time. */}
            <LegendSwatch color={color} stroke={strokeColor ?? '#333333'} />
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
