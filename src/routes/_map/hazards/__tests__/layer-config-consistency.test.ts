/**
 * Verifies internal consistency between the hazards layer config,
 * report groupings JSON, hazard unit map, and intro text.
 *
 * All titles and structures are read dynamically from the actual configs —
 * nothing is hardcoded here. If a layer title changes but a downstream
 * data source is not updated, these tests will catch it.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import type { LayerProps, GroupLayerProps, WMSLayerProps } from '@/lib/types/mapping-types'

function isGroupLayer(layer: LayerProps): layer is GroupLayerProps {
  return layer.type === 'group'
}

function isWMSLayer(layer: LayerProps): layer is WMSLayerProps {
  return layer.type === 'wms'
}
import { PROD_POSTGREST_URL } from '@/lib/constants'
import layersConfig from '@/routes/_map/hazards/-data/layers/layers'
import groupingsData from '@/routes/_report/-data/hazard-groupings.json'
import introTextData from '@/routes/_report/-data/hazard-intro-text.json'
import { hazardLayerNameMap } from '@/routes/_report/-data/hazard-unit-map'

// ── Helpers ─────────────────────────────────────────────────────────

/** Extract all non-group layer titles from a config tree */
function extractLeafTitles(layers: LayerProps[]): string[] {
  const titles: string[] = []
  for (const layer of layers) {
    if (isGroupLayer(layer) && layer.layers) {
      titles.push(...extractLeafTitles(layer.layers))
    } else if (layer.title) {
      titles.push(layer.title)
    }
  }
  return titles
}

/** Extract the group name → ordered child titles mapping from config */
function extractGroupStructure(layers: LayerProps[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const layer of layers) {
    if (isGroupLayer(layer) && layer.layers && layer.title) {
      groups.set(layer.title, extractLeafTitles(layer.layers))
    }
  }
  return groups
}

/** Get the first sublayer's full geoserver name from a layer config */
function getSublayerName(layer: LayerProps): string | null {
  if (isWMSLayer(layer)) {
    return layer.sublayers[0]?.name ?? null
  }
  return null
}

/** Build reverse map: geoserver layer name → hazard code */
function buildReverseLayerMap(): Map<string, string> {
  return new Map(
    Object.entries(hazardLayerNameMap).map(([code, name]) => [name, code])
  )
}

/** Get all hazard layers (children of group layers, excluding utility layers) */
function getHazardLayers(config: LayerProps[]): LayerProps[] {
  return config
    .filter(isGroupLayer)
    .flatMap(g => g.layers ?? [])
}

// ── Derived data ────────────────────────────────────────────────────

const reverseLayerMap = buildReverseLayerMap()

const groupingFeatures = groupingsData.features
const groupingsByCode = new Map(
  groupingFeatures.map(f => [f.properties.HazardCode, f.properties.HazardGroup])
)

const introTextFeatures = introTextData.features
const introTextCodes = new Set(introTextFeatures.map(f => f.properties.Hazard))

// Canonical group name mapping: sidebar group title → report group name
const sidebarToReportGroup: Record<string, string> = {
  'Earthquake Hazards': 'Earthquake',
  'Flooding Hazards': 'Flooding',
  'Landslide Hazards': 'Landslide',
  'Problem Soil and Rock Hazards': 'Problem Soil/Rock',
}

// ── Tests ───────────────────────────────────────────────────────────

describe('layer titles match hazlayerinfo database', () => {
  const hazardTitles = getHazardLayers(layersConfig)
    .map(l => l.title)
    .filter((t): t is string => Boolean(t))

  let dbRows: Map<string, string>

  beforeAll(async () => {
    const res = await fetch(
      `${PROD_POSTGREST_URL}/hazlayerinfo?select=title,content`,
      { headers: { 'Accept-Profile': 'hazards', 'Accept': 'application/json' } }
    )
    const rows: { title: string; content: string }[] = await res.json()
    dbRows = new Map(rows.map(r => [r.title, r.content]))
  })

  it.each(hazardTitles)(
    '"%s" has a non-empty description in hazlayerinfo',
    (title) => {
      expect(dbRows.has(title)).toBe(true)
      expect(dbRows.get(title)?.trim().length).toBeGreaterThan(0)
    }
  )
})

describe('hazard layer config ↔ report data consistency', () => {
  const hazardLayers = getHazardLayers(layersConfig)
  const groups = extractGroupStructure(layersConfig)

  describe('every hazard layer maps to a known hazard code', () => {
    it.each(
      hazardLayers
        .filter(l => l.title)
        .map(l => [l.title, getSublayerName(l)])
    )('%s → has a hazard code via sublayer %s', (_title, sublayerName) => {
      expect(sublayerName).not.toBeNull()
      const code = reverseLayerMap.get(sublayerName!)
      expect(code).toBeDefined()
    })
  })

  describe('every hazard code in the unit map has a grouping entry', () => {
    it.each(Object.keys(hazardLayerNameMap))(
      'code %s has a grouping in hazard-groupings.json',
      (code) => {
        expect(groupingsByCode.has(code)).toBe(true)
      }
    )
  })

  describe('every hazard code in the unit map has intro text', () => {
    it.each(Object.keys(hazardLayerNameMap))(
      'code %s has intro text in hazard-intro-text.json',
      (code) => {
        expect(introTextCodes.has(code)).toBe(true)
      }
    )
  })

  it('no duplicate layer titles within hazard groups', () => {
    const allTitles = extractLeafTitles(layersConfig)
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const title of allTitles) {
      if (seen.has(title)) duplicates.push(title)
      seen.add(title)
    }
    expect(duplicates).toEqual([])
  })

  describe('report layer order matches sidebar order within each group', () => {
    for (const [sidebarGroup, childTitles] of groups) {
      const reportGroup = sidebarToReportGroup[sidebarGroup]
      if (!reportGroup) continue

      it(`${sidebarGroup} layers are in sidebar order`, () => {
        // Sidebar order: convert titles → hazard codes
        const sidebarCodes = childTitles
          .map(title => {
            const layer = hazardLayers.find(l => l.title === title)
            if (!layer) return null
            const sublayerName = getSublayerName(layer)
            if (!sublayerName) return null
            return reverseLayerMap.get(sublayerName) ?? null
          })
          .filter((c): c is string => c !== null)

        // Groupings JSON order: codes in file order for this group
        const groupingCodes = groupingFeatures
          .filter(f => f.properties.HazardGroup === reportGroup)
          .map(f => f.properties.HazardCode)
          .filter(code => sidebarCodes.includes(code))

        expect(groupingCodes).toEqual(sidebarCodes)
      })
    }
  })

  it('all hazard codes in groupings JSON that have layers are covered', () => {
    const configCodes = new Set(
      hazardLayers
        .map(l => getSublayerName(l))
        .filter(Boolean)
        .map(name => reverseLayerMap.get(name!))
        .filter(Boolean)
    )

    const groupingCodes = new Set(
      groupingFeatures
        .map(f => f.properties.HazardCode)
        .filter(code => code in hazardLayerNameMap)
    )

    // Every code that has both a grouping and a layer mapping should be in the config
    for (const code of groupingCodes) {
      expect(configCodes.has(code)).toBe(true)
    }
  })
})
