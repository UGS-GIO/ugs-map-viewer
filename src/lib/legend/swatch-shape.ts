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

function escAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

let svgPatternSeq = 0

/** Standalone SVG swatch for canvas/PDF map legend exports. */
export function swatchSvgHtml(shape: SwatchShape, color: string, stroke?: string, opts?: SwatchSvgOptions): string {
    const fill = escAttr(color)
    const edge = escAttr(stroke ?? 'rgba(0,0,0,0.4)')
    if (shape === 'line') {
        const y = opts?.teeth ? 13 : 10
        const dash = opts?.lineStyle === 'dashed'
            ? ' stroke-dasharray="5 3"'
            : opts?.lineStyle === 'dotted'
                ? ' stroke-dasharray="1.5 2.5"'
                : ''
        const cap = opts?.lineStyle === 'dashed' ? 'butt' : 'round'
        const outline = stroke ? `<line x1="1" y1="${y}" x2="19" y2="${y}" stroke="${edge}" stroke-width="4.5" stroke-linecap="${cap}"${dash}/>` : ''
        const teethSvg = opts?.teeth
            ? `<polygon points="4,${y} 6.5,${y - 5} 9,${y}" fill="${fill}"/><polygon points="11,${y} 13.5,${y - 5} 16,${y}" fill="${fill}"/>`
            : ''
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">${outline}<line x1="1" y1="${y}" x2="19" y2="${y}" stroke="${fill}" stroke-width="${opts?.teeth ? 2 : 3}" stroke-linecap="${cap}"${dash}/>${teethSvg}</svg>`
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
