import type { LegendEntry } from '@/lib/types/mapping-types'
import type { SwatchShape } from '@/lib/legend/swatch-shape'

const FALLBACK_COLOR = '#bdbdbd'

/** Swatch colour, outline, shape, and display text per field value, from a render's legend. */
export function legendLookups(entries: readonly LegendEntry[]) {
    const color = new Map<string, string>()
    const stroke = new Map<string, string | undefined>()
    const shape = new Map<string, SwatchShape | undefined>()
    const label = new Map<string, string>()
    for (const e of entries) {
        const key = e.value ?? e.label
        color.set(key, e.color)
        stroke.set(key, e.stroke)
        shape.set(key, e.shape)
        if (e.value) label.set(e.value, e.label)
    }
    // Grouped renders: each item's own shade and label win over its group's.
    for (const e of entries) {
        for (const v of e.values ?? []) {
            color.set(v.value, v.color)
            if (e.stroke) stroke.set(v.value, e.stroke)
            if (e.shape) shape.set(v.value, e.shape)
            if (v.label) label.set(v.value, v.label)
        }
    }
    return {
        colorFor: (value: string) => color.get(value) ?? FALLBACK_COLOR,
        strokeFor: (value: string) => stroke.get(value),
        shapeFor: (value: string) => shape.get(value),
        labelFor: (value: string) => label.get(value) ?? value,
    }
}
