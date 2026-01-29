/**
 * QFF (Quaternary Faults) custom legend generation
 * Uses the generic legend factory with QFF-specific configuration
 */

import { generateFaultDescription } from '@/routes/_report/-utils/fault-description'
import type { CustomLegendItem } from '@/routes/_report/-components/content/report-legend'
import { createCustomLegend } from '@/routes/_report/-utils/hazard-legend-factory'

/**
 * Generate custom legend items for Quaternary Faults
 * @param polygon - Polygon JSON string
 * @returns Array of custom legend items for QFF layer
 */
export async function generateQFFLegendItems(polygon: string): Promise<CustomLegendItem[]> {
    return createCustomLegend(polygon, {
        code: 'QFF',
        wfsLayer: 'hazards:qfaults_current',
        wmsLayer: 'hazards:qfaults_current',
        properties: 'faultzone,faultname,sectionname,strandname,mappedscale,slipsense,faultage,sliprate,qffhazardunit',
        geometryField: 'geom',
        crs: 'EPSG:3857',
        unitField: 'qffhazardunit',
        groupByField: 'faultzone',
        fallbackField: 'faultname',
        descriptionFn: generateFaultDescription
    })
}
