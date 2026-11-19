export type SwatchShape = 'fill' | 'hatch' | 'line' | 'circle' | 'triangle'

export type SwatchShapeInput = string | { type: string; paint?: Record<string, unknown> }

/**
 * The geometry a render draws, from its first non-label layer; labels alone read as points.
 * When a fill stack includes any `fill-pattern` (even above a solid background fill), it
 * reads as a diagonal hatch swatch.
 */
export function swatchShapeOf(layers: readonly SwatchShapeInput[]): SwatchShape {
    let firstNonLabel: string | null = null
    for (const layer of layers) {
        const type = typeof layer === 'string' ? layer : layer.type
        if (type === 'symbol') continue
        firstNonLabel ??= type
        if (firstNonLabel === 'fill' || firstNonLabel === 'fill-extrusion') {
            if (typeof layer !== 'string' && (type === 'fill' || type === 'fill-extrusion') && Boolean(layer.paint?.['fill-pattern'])) {
                return 'hatch'
            }
        } else {
            break
        }
    }
    if (firstNonLabel === 'fill' || firstNonLabel === 'fill-extrusion') return 'fill'
    if (firstNonLabel === 'line') return 'line'
    if (firstNonLabel === 'circle') return 'circle'
    return 'circle'
}

function escAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

let svgPatternSeq = 0

/** Standalone SVG swatch for canvas/PDF map legend exports. */
export function swatchSvgHtml(shape: SwatchShape, color: string, stroke?: string): string {
    const fill = escAttr(color)
    const edge = escAttr(stroke ?? 'rgba(0,0,0,0.4)')
    if (shape === 'line') {
        const outline = stroke ? `<line x1="1" y1="10" x2="19" y2="10" stroke="${edge}" stroke-width="5" stroke-linecap="round"/>` : ''
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">${outline}<line x1="1" y1="10" x2="19" y2="10" stroke="${fill}" stroke-width="3" stroke-linecap="round"/></svg>`
    }
    if (shape === 'triangle') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><polygon points="10,3 17,16 3,16" fill="${fill}" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"/></svg>`
    }
    if (shape === 'hatch') {
        const pid = `swatch-hatch-${++svgPatternSeq}`
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><defs><pattern id="${pid}" width="6" height="6" patternUnits="userSpaceOnUse"><line x1="-1" y1="1" x2="1" y2="-1" stroke="${fill}" stroke-width="1.5"/><line x1="0" y1="6" x2="6" y2="0" stroke="${fill}" stroke-width="1.5"/><line x1="5" y1="7" x2="7" y2="5" stroke="${fill}" stroke-width="1.5"/></pattern></defs><rect x="2" y="4" width="16" height="12" rx="1.5" fill="url(#${pid})" stroke="${edge}" stroke-width="1.2"/></svg>`
    }
    if (shape === 'fill') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="12" rx="1.5" fill="${fill}" stroke="${edge}" stroke-width="1.2"/></svg>`
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="${fill}" stroke="${edge}" stroke-width="1.2"/></svg>`
}
