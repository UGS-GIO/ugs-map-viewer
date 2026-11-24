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
export function scaleOpacityValue(base: unknown, opacity: number): number | ExpressionSpecification {
    if (typeof base === 'number') return base * opacity
    if (!Array.isArray(base)) return opacity
    if (opacity === 1) return base as ExpressionSpecification
    const [op] = base
    const scaleFrom = typeof op === 'string' && op.startsWith('interpolate') ? 4 : op === 'step' ? 2 : null
    if (scaleFrom == null) return ['*', base as ExpressionSpecification, opacity]
    return base.map((v, i) => (i >= scaleFrom && i % 2 === 0 ? scaleOpacityValue(v, opacity) : v)) as ExpressionSpecification
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
