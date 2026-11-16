export type SwatchShape = 'fill' | 'line' | 'circle'

/** The geometry a render draws, from its first non-label layer; labels alone read as points. */
export function swatchShapeOf(layerTypes: readonly string[]): SwatchShape {
    for (const type of layerTypes) {
        if (type === 'fill' || type === 'fill-extrusion') return 'fill'
        if (type === 'line') return 'line'
        if (type === 'circle') return 'circle'
    }
    return 'circle'
}
