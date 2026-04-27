import type { Symbolizer, RasterColormapEntry } from '@/lib/types/geoserver-types'

export interface RasterSymbolOptions {
    /** Setting this enables min/max labels on the bar. Omit for a label-less colorbar. */
    unit?: string
    /** Override derived min/max from SLD stops. Use when SLD stops don't match true data extent. */
    range?: [number, number]
}

const SVG_NS = 'http://www.w3.org/2000/svg'

// Vertical layout when labels are present: min label, bar, max label.
const LABEL_FONT_SIZE = 10
const MIN_LABEL_BASELINE_Y = 10
const BAR_TOP_Y_WITH_LABELS = 12
const BAR_HEIGHT = 14
const MAX_LABEL_BASELINE_Y = 38
const SVG_HEIGHT_WITH_LABELS = 40

// Compact layout when labels are omitted: just the bar with 1px stroke headroom.
const BAR_TOP_Y_BARE = 1
const SVG_HEIGHT_BARE = 16

let gradientCounter = 0

function formatQuantity(n: number): string {
    const rounded = Math.round(n)
    return Math.abs(rounded) >= 1000 ? rounded.toLocaleString() : String(rounded)
}

function isVisibleEntry(e: RasterColormapEntry): boolean {
    return e.opacity === undefined || parseFloat(e.opacity) > 0
}

function createSVGElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
    return document.createElementNS(SVG_NS, tag)
}

function makeLabel(text: string, x: string, y: number, anchor?: 'end'): SVGTextElement {
    const el = createSVGElement('text')
    el.setAttribute('x', x)
    el.setAttribute('y', String(y))
    el.setAttribute('font-size', String(LABEL_FONT_SIZE))
    el.setAttribute('fill', 'currentColor')
    if (anchor) el.setAttribute('text-anchor', anchor)
    el.textContent = text
    return el
}

/**
 * Full-width colorbar legend for continuous raster symbolizers. Sibling to
 * point.ts / line.ts / polygon.ts. Sets `data-fullwidth="true"` so the legend
 * renderer skips the per-glyph swatch wrapper.
 *
 * Min/max labels are only rendered when `opts.unit` is provided — otherwise
 * the bar renders bare. Layers with stat-derived (rather than data-derived)
 * SLD stops can omit `legendUnit` to avoid showing misleading bounds.
 */
export function createRasterSymbol(symbolizers: Symbolizer[], opts?: RasterSymbolOptions): SVGSVGElement {
    const colormap = symbolizers.find(s => s.Raster)?.Raster?.colormap
    const stops = (colormap?.entries ?? [])
        .filter(isVisibleEntry)
        .map(e => ({ value: Number(e.quantity), color: e.color }))
        .filter(s => Number.isFinite(s.value))

    const showLabels = !!opts?.unit
    const svgHeight = showLabels ? SVG_HEIGHT_WITH_LABELS : SVG_HEIGHT_BARE
    const barTopY = showLabels ? BAR_TOP_Y_WITH_LABELS : BAR_TOP_Y_BARE

    const svg = createSVGElement('svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', String(svgHeight))
    svg.setAttribute('role', 'img')
    svg.dataset.fullwidth = 'true'

    // Categorical colormaps aren't a colorbar — bail to the swatch path.
    if (colormap?.type === 'values') return svg
    if (stops.length === 0) return svg

    const [min, max] = opts?.range ?? [
        Math.min(...stops.map(s => s.value)),
        Math.max(...stops.map(s => s.value)),
    ]
    const range = max - min || 1

    const gradientId = `raster-gradient-${++gradientCounter}`
    const defs = createSVGElement('defs')
    const gradient = createSVGElement('linearGradient')
    gradient.setAttribute('id', gradientId)
    gradient.setAttribute('x1', '0%')
    gradient.setAttribute('x2', '100%')

    const addStop = (offsetPct: number, color: string) => {
        const stopEl = createSVGElement('stop')
        stopEl.setAttribute('offset', `${offsetPct}%`)
        stopEl.setAttribute('stop-color', color)
        gradient.appendChild(stopEl)
    }

    // For 'intervals', emit a duplicate stop at the next offset to get a hard transition.
    const isIntervals = colormap?.type === 'intervals'
    for (let i = 0; i < stops.length; i++) {
        const stop = stops[i]
        addStop(((stop.value - min) / range) * 100, stop.color)
        if (isIntervals && i < stops.length - 1) {
            addStop(((stops[i + 1].value - min) / range) * 100, stop.color)
        }
    }
    defs.appendChild(gradient)
    svg.appendChild(defs)

    const bar = createSVGElement('rect')
    bar.setAttribute('x', '0')
    bar.setAttribute('y', String(barTopY))
    bar.setAttribute('width', '100%')
    bar.setAttribute('height', String(BAR_HEIGHT))
    bar.setAttribute('rx', '2')
    bar.setAttribute('ry', '2')
    bar.setAttribute('fill', `url(#${gradientId})`)
    // Mode-aware outline so the bar's edges stay visible when its colors blend with the panel bg.
    bar.setAttribute('stroke', 'currentColor')
    bar.setAttribute('stroke-width', '1')
    svg.appendChild(bar)

    if (showLabels) {
        const unitSuffix = ` ${opts!.unit}`
        const minLabel = `${formatQuantity(min)}${unitSuffix}`
        const maxLabel = `${formatQuantity(max)}${unitSuffix}`
        svg.appendChild(makeLabel(minLabel, '0', MIN_LABEL_BASELINE_Y))
        svg.appendChild(makeLabel(maxLabel, '100%', MAX_LABEL_BASELINE_Y, 'end'))
        svg.setAttribute('aria-label', `Color ramp from ${minLabel} to ${maxLabel}`)
    } else {
        svg.setAttribute('aria-label', 'Color ramp')
    }

    return svg
}
