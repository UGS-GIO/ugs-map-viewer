import { describe, it, expect } from 'vitest'
import type { GroupLayerProps } from '@/lib/types/mapping-types'
import { isGroupLayer } from '@/lib/map/layer-utils'
import layersConfig from '../-data/layers/layers'

describe('Carbon Storage layer headings and reorganization (ALL-6187)', () => {
  const ccsGroup = layersConfig.find(
    (l): l is GroupLayerProps => isGroupLayer(l) && l.title === 'Carbon Storage Resources'
  )

  const infraGroup = layersConfig.find(
    (l): l is GroupLayerProps => isGroupLayer(l) && l.title === 'Infrastructure and Land Use'
  )

  it('contains Carbon Storage Resources and Infrastructure groups', () => {
    expect(ccsGroup).toBeDefined()
    expect(infraGroup).toBeDefined()
  })

  it('groups Carbon Storage Resources under Statewide, Regional, and Site-Specific section headings', () => {
    const ccsLayers = ccsGroup?.layers ?? []
    expect(ccsLayers).toHaveLength(6)

    // Statewide section (first 4 layers, SITLA at bottom)
    expect(ccsLayers[0].title).toBe('Statewide Storage Resource Estimates')
    expect(ccsLayers[0].sectionHeading).toBe('Statewide')

    expect(ccsLayers[1].title).toBe('Geo-Region Carbon Storage Ranking')
    expect(ccsLayers[1].sectionHeading).toBe('Statewide')

    expect(ccsLayers[2].title).toBe('NATCARB Atlas (2015)')
    expect(ccsLayers[2].sectionHeading).toBe('Statewide')

    expect(ccsLayers[3].title).toBe('CO₂ Storage Potential on SITLA Blocks')
    expect(ccsLayers[3].sectionHeading).toBe('Statewide')

    // Regional section
    expect(ccsLayers[4].title).toBe('Past and Ongoing Projects - Regional')
    expect(ccsLayers[4].sectionHeading).toBe('Regional')

    // Site-Specific section
    expect(ccsLayers[5].title).toBe('Past and Ongoing Projects - Site-Specific')
    expect(ccsLayers[5].sectionHeading).toBe('Site-Specific')
  })

  it('moves CO2 sources and CCS exclusion areas to Infrastructure as top sublayers', () => {
    const infraLayers = infraGroup?.layers ?? []
    expect(infraLayers.length).toBeGreaterThanOrEqual(3)

    expect(infraLayers[0].title).toBe('CO₂ Sources')
    expect(infraLayers[0].sectionHeading).toBeUndefined()

    expect(infraLayers[1].title).toBe('CCS Exclusion Areas')
    expect(infraLayers[1].sectionHeading).toBeUndefined()

    expect(infraLayers[2].title).toBe('Power Plants')
  })
})
