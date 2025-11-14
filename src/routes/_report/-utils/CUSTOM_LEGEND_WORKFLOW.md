# Custom Legend Implementation Workflow

## Overview
This document outlines the step-by-step process for adding a custom legend for any hazard type (currently implemented for QFF).

**TL;DR**: Use the `hazard-legend-factory.ts` to eliminate boilerplate. See "Quick Start" section below.

## Quick Start (Using Factory Pattern)

### For LSS (Landslide Susceptibility):

**1. Create `-utils/lss-legend-service.ts`**:
```typescript
import { generateLSSDescription } from '@/lib/utils'
import type { CustomLegendItem } from '@/routes/_report/-components/content/report-legend'
import { createCustomLegend } from '@/routes/_report/-utils/hazard-legend-factory'

export async function generateLSSLegendItems(polygon: string): Promise<CustomLegendItem[]> {
    return createCustomLegend(polygon, {
        code: 'LSS',
        wfsLayer: 'hazards:landslidesusceptibility',
        wmsLayer: 'hazards:landslidesusceptibility',
        properties: 'lssunit,confidence,certainty',
        filterCondition: `is_current = 'Y'`,
        unitField: 'lssunit',
        // Optional: Add groupByField and fallbackField if your hazard has sub-groupings
        // groupByField: 'zone_identifier',
        // fallbackField: 'zone_name',
        descriptionFn: generateLSSDescription
    })
}
```

**2. Update `hazards-report.tsx`**:
```typescript
// Add import
import { generateLSSLegendItems } from '@/routes/_report/-utils/lss-legend-service'

// Add to Promise.all()
hazardCodes.includes('LSS') ? generateLSSLegendItems(polygon) : Promise.resolve([]),

// Add to layer building
g.HazardCode === 'LSS' ? lssLegendItems : undefined,
```

**3. Create description function** (in `/lib/utils.ts` or custom location):
```typescript
export function generateLSSDescription(properties: any): string {
    // Your custom logic here
    return `High landslide susceptibility`
}
```

**That's it!** 🎉

---

## Detailed Workflow (For Reference)

### 1. Analyze the Hazard Data
**Purpose**: Understand what data you need and where it comes from

- [ ] Identify the hazard code (e.g., `QFF`, `LSS`, `EXS`)
- [ ] Determine the data sources:
  - WFS layer for features (e.g., `hazards:quaternaryfaults_test`)
  - WMS layer for symbols/labels (same as WFS typically)
  - Any custom processing needed (e.g., `generateFaultDescription()`)
- [ ] Identify relevant properties from the WFS features
- [ ] Check if WMS legend rule titles are appropriate for display

**Example (QFF)**:
```
Hazard Code: QFF
WFS Layer: hazards:quaternaryfaults_test
WMS Layer: hazards:quaternaryfaults_test
Feature Properties: faultzone, faultname, sectionname, slipsense, qffhazardunit, etc.
Custom Processing: generateFaultDescription(properties)
WMS Legend Titles: "<150 Years, Well Constrained" ✓ (perfect!)
```

### 2. Create the Legend Service File
**File Location**: `-utils/{hazard-code}-legend-service.ts` (lowercase)

**Template** (using `hazard-legend-factory.ts`):
```typescript
import { generateXXXDescription } from '@/lib/utils'  // or custom function
import type { CustomLegendItem } from '@/routes/_report/-components/content/report-legend'
import { createCustomLegend } from '@/routes/_report/-utils/hazard-legend-factory'

/**
 * Generate custom legend items for XXX hazard
 * @param polygon - ESRI polygon JSON string
 * @returns Array of custom legend items
 */
export async function generateXXXLegendItems(polygon: string): Promise<CustomLegendItem[]> {
    return createCustomLegend(polygon, {
        code: 'XXX',
        wfsLayer: 'hazards:xxx_layer_name',
        wmsLayer: 'hazards:xxx_layer_name',
        properties: 'prop1,prop2,prop3,xxx_unit_field',  // Specify properties to fetch
        filterCondition: `filter_condition = 'Y'`,  // CQL filter if needed
        unitField: 'xxx_unit_field',  // e.g., qffhazardunit, lssunit

        // OPTIONAL: For hazards with multiple sub-items per unit (e.g., multiple fault zones)
        // groupByField: 'secondary_identifier',  // Creates separate legend items per group
        // fallbackField: 'fallback_identifier',  // Used when primary field is null

        descriptionFn: generateXXXDescription
    })
}
```

**That's it!** The `hazard-legend-factory.ts` handles:
- WFS feature queries
- WMS legend fetching and symbol generation
- Feature grouping by unit code (or composite key if `groupByField` is specified)
- Legend item creation

No need to manually implement the orchestration logic.

### Optional: Multi-Level Grouping

If your hazard has multiple items per unit code (e.g., QFF has multiple fault zones per unit), use `groupByField`:

```typescript
export async function generateXXXLegendItems(polygon: string): Promise<CustomLegendItem[]> {
    return createCustomLegend(polygon, {
        code: 'XXX',
        wfsLayer: 'hazards:xxx_layer_name',
        wmsLayer: 'hazards:xxx_layer_name',
        properties: 'prop1,prop2,grouping_field,fallback_field,xxx_unit_field',
        unitField: 'xxx_unit_field',
        groupByField: 'grouping_field',      // Primary grouping identifier
        fallbackField: 'fallback_field',     // Used if grouping_field is null
        descriptionFn: generateXXXDescription
    })
}
```

The factory will:
1. Create composite keys: `{unitCode}|{groupIdentifier}`
2. Use fallback field when primary field is null
3. Pass all features in each group to the description function
4. Still use unit code for WMS symbol/label lookups

**Example (QFF)**:
```typescript
{
    unitField: 'qffhazardunit',
    groupByField: 'faultzone',      // Primary identifier
    fallbackField: 'faultname',     // Fallback when faultzone is null
    descriptionFn: generateFaultDescription
}
```

This creates separate legend items for each unique fault zone within each unit code.

### 3. Update hazards-report.tsx
**Location**: Main component that orchestrates data fetching

**Changes**:
```typescript
// 1. Import the new legend service
import { generateXXXLegendItems } from '@/routes/_report/-utils/xxx-legend-service'

// 2. Add to Promise.all() in the query hook
const [
    groupings,
    hazardUnitText,
    allHazardUnits,
    hazardReferences,
    qffLegendItems,
    xxxLegendItems,  // ADD THIS
] = await Promise.all([
    Promise.resolve(queryGroupingStatic(flatUnitCodes)),
    Promise.resolve(queryHazardUnitsStatic(flatUnitCodes)),
    Promise.resolve(queryAllUnitsForHazardCodes(hazardCodes)),
    Promise.resolve(queryReferencesStatic(flatUnitCodes)),
    hazardCodes.includes('QFF') ? generateQFFLegendItems(polygon) : Promise.resolve([]),
    hazardCodes.includes('XXX') ? generateXXXLegendItems(polygon) : Promise.resolve([]),  // ADD THIS
])

// 3. In the layer building loop, add customLegendItems
customLegendItems: g.HazardCode === 'QFF' ? qffLegendItems :
                   g.HazardCode === 'XXX' ? xxxLegendItems : undefined,  // ADD THIS
```

### 4. Test the Implementation
**Checklist**:
- [ ] Build passes without errors (`npm run build`)
- [ ] Test in browser with a polygon that has the hazard
- [ ] Verify legend displays correctly in report
- [ ] Check browser console for any warnings/errors
- [ ] Verify symbols show properly
- [ ] Verify descriptions generate correctly
- [ ] Test with polygon that has NO instances of the hazard (should not show in legend)

## File Organization Reference

```
src/routes/_report/
├── -components/
│   ├── hazards-report.tsx                (Main orchestrator - import all legend services)
│   └── content/
│       └── report-legend.tsx             (Renders both WMS and custom legends)
├── -utils/
│   ├── hazard-legend-factory.ts          (Generic factory - createCustomLegend<T>())
│   ├── geoserver-wfs-service.ts          (WFS queries)
│   ├── static-hazards-service.ts         (PostgREST queries)
│   ├── qff-legend-service.ts             (QFF-specific legend)
│   └── xxx-legend-service.ts             (NEW: XXX-specific legend) ✨
└── -data/
    └── hazard-unit-map.ts                (Hazard code to layer name mapping)

src/lib/legend/
├── wms-legend-service.ts                 (Consolidated WMS utilities)
├── symbol-generator.ts                   (SVG symbol generation)
└── symbolizers/                          (Symbolizer implementations)
    ├── point.ts
    ├── line.ts
    └── polygon.ts
```

## Example: Adding LSS (Landslide Susceptibility) Custom Legend

### 1. Analyze Data
```
Hazard Code: LSS
WFS Layer: hazards:landslidesusceptibility
WMS Layer: hazards:landslidesusceptibility
Key Properties: lssunit, confidence, certainty
Custom Processing: Generate based on unit properties
```

### 2. Create `-utils/lss-legend-service.ts`
```typescript
import { generateLSSDescription } from '@/lib/utils'
import type { CustomLegendItem } from '@/routes/_report/-components/content/report-legend'
import { createCustomLegend } from '@/routes/_report/-utils/hazard-legend-factory'

export async function generateLSSLegendItems(polygon: string): Promise<CustomLegendItem[]> {
    return createCustomLegend(polygon, {
        code: 'LSS',
        wfsLayer: 'hazards:landslidesusceptibility',
        wmsLayer: 'hazards:landslidesusceptibility',
        properties: 'lssunit,confidence,certainty',
        filterCondition: `is_current = 'Y'`,
        unitField: 'lssunit',
        descriptionFn: generateLSSDescription
    })
}
```

### 3. Update `hazards-report.tsx`
```typescript
import { generateLSSLegendItems } from '@/routes/_report/-utils/lss-legend-service'

// Add to Promise.all()
hazardCodes.includes('LSS') ? generateLSSLegendItems(polygon) : Promise.resolve([]),

// Add to layer building
g.HazardCode === 'LSS' ? lssLegendItems : undefined,
```

### 4. Test with LSS polygons

## Tips & Best Practices

1. **Use the factory pattern**: Always call `createCustomLegend()` with a config object
2. **Keep service files minimal**: Just export a wrapper function with the hazard-specific config
3. **WMS utilities**: Use `buildGetLegendGraphicUrl()` and `extractWMSLiteralValue()` from `lib/legend/wms-legend-service.ts` if needed
4. **Error handling**: The factory handles all error cases; just implement your `descriptionFn`
5. **Feature filtering**: Only show legend items for units that actually exist in polygon (factory handles this)
6. **Naming**: Use hazard code in lowercase for service filenames (qff, lss, xxx)
7. **Documentation**: Add JSDoc comments explaining what the function does
8. **Multi-level grouping**: If your hazard has multiple items per unit (e.g., multiple fault zones per unit code):
   - Add `groupByField` to identify the sub-grouping
   - Add `fallbackField` for cases where the primary grouping field is null
   - The factory will automatically create separate legend items for each group
   - Update your `descriptionFn` to accept array of features if needed (e.g., `generateFaultDescription(features: T[])`)
9. **Description functions**: Can accept either single features or arrays of features (the factory passes all features in a group)

## Debugging

If legend doesn't show:
- Check browser console for errors in legend service
- Verify hazard code is in `hazardCodes` array
- Verify WFS query returns features (check Network tab)
- Verify WMS legend fetch succeeds
- Check that `customLegendItems` is being passed to layer object

If symbols don't show:
- Check WMS legend graphic response has symbolizers
- Verify `createSVGSymbol()` is working
- Check WMS filter extraction matches unit code format
- Verify `extractWMSLiteralValue()` correctly extracts unit codes from filters
- **For multi-level grouping**: Verify unit code is properly extracted from composite key (e.g., `unitCode|identifier` → `unitCode`)

If descriptions are wrong:
- Verify feature properties are being fetched correctly
- Check custom description function logic
- If using `groupByField`, verify `descriptionFn` can handle arrays of features
- Test `descriptionFn` in isolation

If multi-level grouping creates too many legend items:
- Verify `groupByField` has the correct field name
- Check if null values in grouping field are being properly handled by `fallbackField`
- Ensure fallback field isn't creating unwanted extra items
- Consider if grouping is actually needed (only use if truly have multiple sub-items per unit)
