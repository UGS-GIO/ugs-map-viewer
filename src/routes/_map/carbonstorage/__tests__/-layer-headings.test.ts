import { describe, it, expect } from 'vitest'
import type { LayerProps, GroupLayerProps } from '@/lib/types/mapping-types'
import layersConfig from '../-data/layers/layers'

function isGroupLayer(layer: LayerProps): layer is GroupLayerProps {
  return layer.type === 'group'
}

describe('Carbon Storage layer headings and reorganization (ALL-6187)', () => {
  const ccsGroup = layersConfig.find(
    (l) => isGroupLayer(l) && l.title === 'Carbon Storage Resources'
  ) as GroupLayerProps | undefined

  const infraGroup = layersConfig.find(
    (l) => isGroupLayer(l) && l.title === 'Infrastructure and Land Use'
  ) as GroupLayerProps | undefined

  it('contains Carbon Storage Resources and Infrastructure groups', () => {
    expect(ccsGroup).toBeDefined()
    expect(infraGroup).toBeDefined()
  })

  it('groups Carbon Storage Resources under Statewide and Regional section headings', () => {
    const ccsLayers = ccsGroup?.layers ?? []
    expect(ccsLayers).toHaveLength(5)

    // Statewide section (first 3 layers)
    expect(ccsLayers[0].title).toBe('Statewide Storage Resource Estimates')
    expect(ccsLayers[0].sectionHeading).toBe('Statewide')

    expect(ccsLayers[1].title).toBe('Geo-region Carbon Storage Ranking')
    expect(ccsLayers[1].sectionHeading).toBe('Statewide')

    expect(ccsLayers[2].title).toBe('NATCARB Atlas (2015)')
    expect(ccsLayers[2].sectionHeading).toBe('Statewide')

    // Regional section
    expect(ccsLayers[3].title).toBe('CCUS Projects')
    expect(ccsLayers[3].sectionHeading).toBe('Regional')

    // Remaining layer with no section heading
    expect(ccsLayers[4].title).toBe('CO₂ Storage Potential on SITLA Blocks')
    expect(ccsLayers[4].sectionHeading).toBeUndefined()
  })

  it('moves CO2 sources and CCS exclusion areas to Infrastructure as top sublayers', () => {
    const infraLayers = infraGroup?.layers ?? []
    expect(infraLayers.length).toBeGreaterThanOrEqual(2)

    // Top sublayer
    expect(infraLayers[0].title).toBe('CO₂ Sources')
    expect(infraLayers[0].sectionHeading).toBeUndefined()

    // Second sublayer
    expect(infraLayers[1].title).toBe('CCS Exclusion Areas')
    expect(infraLayers[1].sectionHeading).toBeUndefined()

    // Followed by Power Plants
    expect(infraLayers[2].title).toBe('Power Plants')
  })
})
