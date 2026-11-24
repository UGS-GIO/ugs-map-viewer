import type { ExpressionSpecification } from 'maplibre-gl'

type OpacityProp =
    | 'circle-opacity' | 'circle-stroke-opacity' | 'line-opacity' | 'fill-opacity'
    | 'icon-opacity' | 'text-opacity' | 'fill-extrusion-opacity' | 'raster-opacity'

/** Paint properties the opacity slider drives, per MapLibre layer type. */
export const OPACITY_PROPS: Partial<Record<string, readonly OpacityProp[]>> = {
    circle: ['circle-opacity', 'circle-stroke-opacity'],
    line: ['line-opacity'],
    fill: ['fill-opacity'],
    symbol: ['icon-opacity', 'text-opacity'],
    'fill-extrusion': ['fill-extrusion-opacity'],
    raster: ['raster-opacity'],
}

/**
 * Scale an authored opacity by the slider value. Zoom curves must stay top-level
 * `interpolate`/`step`, so their stop outputs are scaled instead of wrapping in `*`.
 */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)

// Authored style JSON; MapLibre validates the full expression when the layer is added.
const isExpression = (v: unknown): v is ExpressionSpecification => Array.isArray(v) && typeof v[0] === 'string'

export function scaleOpacityValue(base: unknown, opacity: number): number | ExpressionSpecification {
    if (typeof base === 'number') return base * opacity
    if (!isExpression(base)) return opacity
    if (opacity === 1) return base
    if (base[0] === 'interpolate') {
        const [op, interpolation, input, ...stops] = base
        return [op, interpolation, input, ...stops.map((v, i) => (i % 2 === 1 ? scaleOpacityValue(v, opacity) : v))]
    }
    if (base[0] === 'step') {
        const [op, input, first, ...stops] = base
        return [op, input, scaleOpacityValue(first, opacity), ...stops.map((v, i) => (i % 2 === 1 ? scaleOpacityValue(v, opacity) : v))]
    }
    return ['*', base, opacity]
}

/** The opacity props for `type`, each scaled from `base` (authored paint). */
export function scaledOpacityPaint(base: Record<string, unknown> | undefined, type: string, opacity: number): Array<[OpacityProp, number | ExpressionSpecification]> {
    return (OPACITY_PROPS[type] ?? []).map(prop => [prop, scaleOpacityValue(base?.[prop], opacity)])
}

/** The authored opacity props, stashed in layer metadata so live slider drags scale from them. */
export function baseOpacityOf(paint: Record<string, unknown> | undefined, type: string): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const prop of OPACITY_PROPS[type] ?? []) if (paint?.[prop] != null) out[prop] = paint[prop]
    return out
}
