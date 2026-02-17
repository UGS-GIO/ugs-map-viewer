/**
 * Shared legend utilities for report generation
 */

/**
 * Extract the literal value from a WMS rule filter
 * Filters are in the format: "[fieldname = 'value']"
 * @example
 * "[grshazardunit = 'Hgrs']" -> "Hgrs"
 * "[qffhazardunit = 'U15KWCqff']" -> "U15KWCqff"
 */
export const extractWMSLiteralValue = (filter: string): string | undefined => {
    try {
        const match = filter.match(/=\s*'([^']+)'/)
        return match?.[1]
    } catch (error) {
        console.warn('Error extracting literal value from WMS rule:', error)
        return undefined
    }
}
