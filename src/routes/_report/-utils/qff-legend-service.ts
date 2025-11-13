/**
 * QFF (Quaternary Faults) custom legend generation
 * Uses the generic legend factory with QFF-specific configuration
 */

import { generateFaultDescription } from '@/lib/utils'
import type { CustomLegendItem } from '@/routes/_report/-components/content/report-legend'
import { createCustomLegend } from '@/routes/_report/-utils/hazard-legend-factory'

/**
 * Generate custom legend items for Quaternary Faults
 * @param polygon - ESRI polygon JSON string
 * @returns Array of custom legend items for QFF layer
 */
export async function generateQFFLegendItems(polygon: string): Promise<CustomLegendItem[]> {
    return createCustomLegend(polygon, {
        code: 'QFF',
        wfsLayer: 'hazards:quaternaryfaults_test',
        wmsLayer: 'hazards:quaternaryfaults_test',
        properties: 'faultzone,faultname,sectionname,strandname,mappedscale,slipsense,faultage,sliprate,qffhazardunit',
        filterCondition: `is_current = 'Y'`,
        unitField: 'qffhazardunit',
        groupByField: 'faultzone',
        fallbackField: 'faultname',
        descriptionFn: generateFaultDescription
    })
}
