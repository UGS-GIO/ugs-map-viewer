/**
 * Generic hazard legend factory
 * Eliminates boilerplate for creating custom legends for any hazard type
 */

import type { CustomLegendItem } from '@/routes/_report/-components/content/report-legend'
import { createSVGSymbol } from '@/lib/legend/symbol-generator'
import type { Legend } from '@/lib/types/geoserver-types'
import { queryWFSFeatures, convertPolygonStringToWKT } from '@/routes/_report/-utils/geoserver-wfs-service'
import { extractWMSLiteralValue, buildGetLegendGraphicUrl } from '@/lib/legend/wms-legend-service'

export interface HazardLegendConfig<T extends Record<string, any>> {
    /**
     * Hazard code (e.g., 'QFF', 'LSS', 'EXS')
     */
    code: string

    /**
     * WFS layer name (e.g., 'hazards:quaternaryfaults_test')
     */
    wfsLayer: string

    /**
     * WMS layer name (typically same as WFS)
     */
    wmsLayer: string

    /**
     * Comma-separated list of property names to fetch from WFS
     */
    properties: string

    /**
     * CQL filter condition (e.g., "is_current = 'Y'")
     */
    filterCondition?: string

    /**
     * Field name that contains the unit/category code
     * (e.g., 'qffhazardunit', 'lssunit')
     */
    unitField: keyof T

    /**
     * Optional: Field name to group by within each unit (e.g., 'faultzone', 'faultname')
     * If provided, creates separate legend items for each unique value of this field
     * Falls back to this field if the primary identifier is null
     * (e.g., for QFF: use faultzone, fall back to faultname)
     */
    groupByField?: keyof T
    fallbackField?: keyof T

    /**
     * Function to generate description from feature(s)
     * Receives an array of feature properties (all features for this unit) and returns a description string
     */
    descriptionFn: (features: T[]) => string
}

/**
 * Generic legend factory function
 * Creates custom legend items for any hazard type following a consistent pattern
 *
 * @param polygon - Polygon JSON string
 * @param config - Configuration object specific to the hazard type
 * @returns Array of custom legend items
 *
 * @example
 * const qffLegend = await createCustomLegend(polygon, {
 *     code: 'QFF',
 *     wfsLayer: 'hazards:quaternaryfaults_test',
 *     wmsLayer: 'hazards:quaternaryfaults_test',
 *     properties: 'faultzone,faultname,slipsense,qffhazardunit',
 *     unitField: 'qffhazardunit',
 *     descriptionFn: generateFaultDescription
 * })
 */
export async function createCustomLegend<T extends Record<string, any>>(
    polygon: string,
    config: HazardLegendConfig<T>
): Promise<CustomLegendItem[]> {
    try {
        // Step 1: Fetch features from WFS
        const polygonWKT = convertPolygonStringToWKT(polygon)
        const features = await queryWFSFeatures<T>(
            config.wfsLayer,
            polygonWKT,
            config.properties,
            config.filterCondition
        )


        if (features.length === 0) {
            return []
        }

        // Step 2: Fetch WMS legend for symbols and labels
        const wmsSymbols = new Map<string, any>()
        const wmsLabels = new Map<string, string>()
        try {
            const legendUrl = buildGetLegendGraphicUrl(config.wmsLayer)
            const legendResponse = await fetch(legendUrl)
            if (legendResponse.ok) {
                const legendData: Legend = await legendResponse.json()
                const rules = legendData?.Legend?.[0]?.rules || []

                for (const rule of rules) {
                    const literalValue = extractWMSLiteralValue(rule.filter)
                    if (literalValue && rule.symbolizers) {
                        const svg = createSVGSymbol(rule.symbolizers)
                        wmsSymbols.set(literalValue, svg)
                        wmsLabels.set(literalValue, rule.title || rule.name)
                    }
                }
            }
        } catch (error) {
            console.warn(`Error fetching WMS legend symbols for ${config.code}:`, error)
        }

        // Step 3: Group features by unit and optionally by a secondary field
        const featuresByUnit = new Map<string, T[]>()
        for (const feature of features) {
            const unitCode = String(feature.properties[config.unitField])

            let groupKey = unitCode

            // If groupByField is specified, add it to the key to create separate items
            if (config.groupByField) {
                const groupValue = feature.properties[config.groupByField]
                const fallbackValue = config.fallbackField ? feature.properties[config.fallbackField] : null
                const identifier = groupValue || fallbackValue || 'Unknown'
                groupKey = `${unitCode}|${identifier}`
            }

            if (!featuresByUnit.has(groupKey)) {
                featuresByUnit.set(groupKey, [])
            }
            featuresByUnit.get(groupKey)!.push(feature.properties)
        }


        // Step 4: Create legend items
        const legendItems: CustomLegendItem[] = []
        for (const [groupKey, unitFeatures] of featuresByUnit) {
            // Extract the unit code from the composite key (e.g., "U15KWCqff|Oquirrh fault zone" -> "U15KWCqff")
            const unitCode = groupKey.split('|')[0]

            // Pass all features for this unit to the description function
            const description = config.descriptionFn(unitFeatures)
            const wmsLabel = wmsLabels.get(unitCode) || unitCode

            legendItems.push({
                label: wmsLabel,
                literalValue: unitCode,
                description,
                html: wmsSymbols.get(unitCode)
            })
        }

        return legendItems
    } catch (error) {
        console.error(`Error generating ${config.code} legend items:`, error)
        return []
    }
}
