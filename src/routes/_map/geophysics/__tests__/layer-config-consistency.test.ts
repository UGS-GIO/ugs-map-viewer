/**
 * Verifies that every layer title in the geophysics config
 * has a matching description row in the geophysicslayerinfo database table.
 *
 * All titles are read dynamically from the actual config — nothing is
 * hardcoded. If a layer title changes but the database is not updated,
 * these tests will catch it.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import type { LayerProps } from '@/lib/types/mapping-types'
import { isGroupLayer } from '@/lib/map/layer-utils'
import { PROD_POSTGREST_URL } from '@/lib/constants'
import layersConfig from '@/routes/_map/geophysics/-data/layers/layers'

// ── Helpers ─────────────────────────────────────────────────────────

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

// ── Tests ───────────────────────────────────────────────────────────

describe('geophysics layer config ↔ database consistency', () => {
  const leafTitles = extractLeafTitles(layersConfig)

  let dbRows: Map<string, string>

  beforeAll(async () => {
    const res = await fetch(
      `${PROD_POSTGREST_URL}/geophysicslayerinfo?select=title,content`,
      { headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' } }
    )
    const rows: { title: string; content: string }[] = await res.json()
    dbRows = new Map(rows.map(r => [r.title, r.content]))
  })

  it.each(leafTitles)(
    '"%s" has a non-empty description in geophysicslayerinfo',
    (title) => {
      expect(dbRows.has(title)).toBe(true)
      expect(dbRows.get(title)?.trim().length).toBeGreaterThan(0)
    }
  )

  it('no duplicate layer titles', () => {
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const title of leafTitles) {
      if (seen.has(title)) duplicates.push(title)
      seen.add(title)
    }
    expect(duplicates).toEqual([])
  })
})
