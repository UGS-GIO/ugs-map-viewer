export type SwatchShape = 'fill' | 'hatch' | 'line' | 'circle' | 'triangle'
export type LineStyle = 'solid' | 'dashed' | 'dotted'

export interface SwatchSvgOptions {
    lineStyle?: LineStyle
    teeth?: boolean
}

/** The geometry a render draws, from its first non-label layer; labels alone read as points. */
export function swatchShapeOf(layerTypes: readonly string[]): SwatchShape {
    for (const type of layerTypes) {
        if (type === 'fill' || type === 'fill-extrusion') return 'fill'
        if (type === 'line') return 'line'
        if (type === 'circle') return 'circle'
    }
    return 'circle'
}

/** Line swatch in a 28×14 box, shared by the sidebar legend and the map export legend. */
interface LineSwatchGeometry {
    y: number
    strokeWidth: number
    dash: string | undefined
    cap: 'butt' | 'round'
    teeth: string[]
}

export function lineSwatchGeometry(lineStyle?: LineStyle, teeth?: boolean): LineSwatchGeometry {
    return {
        y: teeth ? 10.5 : 7,
        strokeWidth: 1.75,
        dash: lineStyle === 'dashed' ? '5.5 3.5' : lineStyle === 'dotted' ? '1.6 3' : undefined,
        cap: lineStyle === 'dashed' ? 'butt' : 'round',
        teeth: teeth ? ['6,10.5 9,4.5 12,10.5', '16,10.5 19,4.5 22,10.5'] : [],
    }
}

function escAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

let svgPatternSeq = 0

/** Standalone SVG swatch for canvas/PDF map legend exports. */
export function swatchSvgHtml(shape: SwatchShape, color: string, stroke?: string, opts?: SwatchSvgOptions): string {
    const fill = escAttr(color)
    const edge = escAttr(stroke ?? 'rgba(0,0,0,0.4)')
    if (shape === 'line') {
        const g = lineSwatchGeometry(opts?.lineStyle, opts?.teeth)
        const dash = g.dash ? ` stroke-dasharray="${g.dash}"` : ''
        const line = (paint: string, width: number) =>
            `<line x1="1" y1="${g.y}" x2="27" y2="${g.y}" stroke="${paint}" stroke-width="${width}" stroke-linecap="${g.cap}"${dash}/>`
        const outline = stroke ? line(edge, g.strokeWidth + 2.5) : ''
        const teethSvg = g.teeth.map(points => `<polygon points="${points}" fill="${fill}"/>`).join('')
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 28 14">${outline}${line(fill, g.strokeWidth)}${teethSvg}</svg>`
    }
    if (shape === 'triangle') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><polygon points="10,3 17,16 3,16" fill="${fill}" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"/></svg>`
    }
    if (shape === 'hatch') {
        const pid = `swatch-hatch-${++svgPatternSeq}`
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><defs><pattern id="${pid}" width="5" height="5" patternUnits="userSpaceOnUse"><line x1="-1" y1="1" x2="1" y2="-1" stroke="${fill}" stroke-width="1"/><line x1="0" y1="5" x2="5" y2="0" stroke="${fill}" stroke-width="1"/><line x1="4" y1="6" x2="6" y2="4" stroke="${fill}" stroke-width="1"/></pattern></defs><rect x="2" y="4" width="16" height="12" rx="1.5" fill="url(#${pid})" stroke="${edge}" stroke-width="1.2"/></svg>`
    }
    if (shape === 'fill') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="12" rx="1.5" fill="${fill}" stroke="${edge}" stroke-width="1.2"/></svg>`
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="${fill}" stroke="${edge}" stroke-width="1.2"/></svg>`
}
