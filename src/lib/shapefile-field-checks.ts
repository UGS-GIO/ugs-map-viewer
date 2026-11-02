/**
 * Shapefile field-name limits: names > 10 chars are truncated, two that collapse to the
 * same 10 chars silently lose a column, and 255 fields is a hard cap.
 * Kept out of gdal-export so the download menu can check fields without loading gdal3.js.
 */
export function shapefileFieldChecks(cols: string[]): {
    longNames: string[]
    collisions: [string, string][]
    fieldCount: number
    tooManyFields: boolean
} {
    const longNames = cols.filter(c => c.length > 10)
    const seen = new Map<string, string>()
    const collisions: [string, string][] = []
    for (const c of cols) {
        const key = c.slice(0, 10).toLowerCase()
        if (seen.has(key)) collisions.push([seen.get(key)!, c])
        else seen.set(key, c)
    }
    return { longNames, collisions, fieldCount: cols.length, tooManyFields: cols.length > 255 }
}
