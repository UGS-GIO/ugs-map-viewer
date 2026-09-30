import { LOW_DATA_QUALS } from './displacement-layers'

// Low/very-low contours that were independently confirmed are their own class
// (hatched on the map, "low quality, independent observations"), toggled apart
// from the unconfirmed low/very-low. The toggle rides in the same per-type
// exclusion set as the data_qual categories, under this key, so it shares the
// URL state and Reset. The space keeps it from ever matching a data_qual value
// used in CQL; it is never sent to GeoServer as a category.
export const CONFIRMED_LOW_KEY = 'confirmed low'

const LOW = LOW_DATA_QUALS as readonly string[]

interface QualityProps {
    data_qual?: number | string | null
    independent_confirmation?: boolean | null
}

export function isConfirmedLow(p: QualityProps): boolean {
    return LOW.includes(String(p.data_qual ?? '')) && p.independent_confirmation === true
}

// Client-side twin of dataQualityCql: the charts, KPIs and rankings must keep
// exactly the contours the map draws.
export function passesDataQuality(p: QualityProps, excluded: ReadonlySet<string>): boolean {
    if (isConfirmedLow(p)) return !excluded.has(CONFIRMED_LOW_KEY)
    return !excluded.has(String(p.data_qual ?? ''))
}

function quoteCqlLiteral(value: string): string {
    return `'${value.replace(/'/g, "''")}'`
}

// CQL for the same rule, or null when nothing is filtered. NOT IN keeps unknown
// future categories visible by default. A null independent_confirmation counts
// as unconfirmed, matching passesDataQuality.
export function dataQualityCql(excluded: ReadonlySet<string>): string | null {
    const lowList = LOW.map(quoteCqlLiteral).join(', ')
    const confirmedLow = `(independent_confirmation = true AND data_qual IN (${lowList}))`
    const notConfirmedLow = `(data_qual NOT IN (${lowList}) OR independent_confirmation = false OR independent_confirmation IS NULL)`
    const categories = [...excluded].filter(q => q !== CONFIRMED_LOW_KEY)
    const categoryClause = categories.length > 0
        ? `data_qual NOT IN (${categories.map(quoteCqlLiteral).join(', ')})`
        : null
    if (excluded.has(CONFIRMED_LOW_KEY)) {
        return categoryClause ? `(${notConfirmedLow} AND ${categoryClause})` : notConfirmedLow
    }
    return categoryClause ? `(${confirmedLow} OR ${categoryClause})` : null
}
