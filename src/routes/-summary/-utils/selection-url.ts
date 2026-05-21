/**
 * Selection encoding for the summary page URL.
 *
 * Mirrors the existing `features` search param on the `_map` route (format
 * `layer:id,layer:id,…`) so a selection can round-trip from popup → summary
 * → back to map without re-encoding logic in two places. Identifiers prefer
 * `ogc_fid` (stable across WFS pagination) and fall back to the feature's
 * built-in id.
 */

export interface SelectionRef {
    /** Layer title (matches LayerContentProps.layerTitle). */
    layerTitle: string
    /** Stable feature identifier within the layer. */
    featureId: string
}

export function encodeSelection(refs: SelectionRef[]): string {
    return refs
        .map(r => `${r.layerTitle}:${r.featureId}`)
        .join(',')
}

export function decodeSelection(raw: string | undefined): SelectionRef[] {
    if (!raw) return []
    return raw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
            const idx = s.lastIndexOf(':')
            if (idx < 0) return null
            return { layerTitle: s.slice(0, idx), featureId: s.slice(idx + 1) }
        })
        .filter((r): r is SelectionRef => r !== null)
}
