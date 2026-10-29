import { describe, expect, it } from 'vitest'
import { moveUnderHillshade } from '../terrain-layers'

const HILLSHADE_ID = 'terrain-hillshade'

function fakeMap(layers: Array<{ id: string; title?: string }>) {
  const order = layers.map((l) => l.id)
  const metadata = new Map(layers.map((l) => [l.id, l.title ? { title: l.title } : undefined]))
  return {
    order,
    getLayersOrder: () => [...order],
    getLayer: (id: string) => (order.includes(id) ? { metadata: metadata.get(id) } : undefined),
    moveLayer: (id: string, beforeId?: string) => {
      order.splice(order.indexOf(id), 1)
      order.splice(beforeId ? order.indexOf(beforeId) : order.length, 0, id)
    },
  }
}

describe('moveUnderHillshade', () => {
  it('moves every style layer of a blended layer under the hillshade, keeping their order', () => {
    const map = fakeMap([
      { id: 'basemap-fill' },
      { id: HILLSHADE_ID },
      { id: 'basemap-labels' },
      { id: 'geology-fill', title: 'Geology' },
      { id: 'geology-line', title: 'Geology' },
      { id: 'wells', title: 'Wells' },
    ])
    moveUnderHillshade(map, new Set(['Geology']))
    expect(map.order).toEqual(['basemap-fill', 'geology-fill', 'geology-line', HILLSHADE_ID, 'basemap-labels', 'wells'])
  })

  it('leaves layers already under the hillshade alone', () => {
    const map = fakeMap([{ id: 'geology-fill', title: 'Geology' }, { id: HILLSHADE_ID }, { id: 'wells', title: 'Wells' }])
    moveUnderHillshade(map, new Set(['Geology']))
    expect(map.order).toEqual(['geology-fill', HILLSHADE_ID, 'wells'])
  })

  it('does nothing before the hillshade is added', () => {
    const map = fakeMap([{ id: 'basemap-fill' }, { id: 'geology-fill', title: 'Geology' }])
    moveUnderHillshade(map, new Set(['Geology']))
    expect(map.order).toEqual(['basemap-fill', 'geology-fill'])
  })
})
