import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAllWfsFeatures } from '../wfs-service'

// Fake GeoServer: serves `total` point features, honoring count/startIndex.
function mockGeoServer(total: number, { withNumberMatched = true, dropFromPage = -1 } = {}) {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = new URL(String(input))
    const count = Number(url.searchParams.get('count'))
    const start = Number(url.searchParams.get('startIndex') ?? 0)
    const n = Math.max(0, Math.min(count, total - start)) - (start === dropFromPage ? 1 : 0)
    const features = Array.from({ length: n }, (_, i) => ({
      type: 'Feature', geometry: null, properties: { fid: start + i },
    }))
    const body: Record<string, unknown> = { type: 'FeatureCollection', features }
    if (withNumberMatched) body.numberMatched = total
    return new Response(JSON.stringify(body), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('fetchAllWfsFeatures', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('counts with a 1-row request, then loads every page and returns each feature once', async () => {
    const fetchMock = mockGeoServer(25_000)
    const features = await fetchAllWfsFeatures('https://gs.example/wfs', 'ns:layer', { pageSize: 10_000, sortBy: 'fid' })
    expect(features).toHaveLength(25_000)
    expect(new Set(features.map(f => (f.properties as { fid: number }).fid)).size).toBe(25_000)
    expect(fetchMock).toHaveBeenCalledTimes(4) // count probe + 3 pages
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('count')).toBe('1')
    const url = new URL(String(fetchMock.mock.calls[2][0]))
    expect(url.searchParams.get('startIndex')).toBe('10000')
    expect(url.searchParams.get('sortBy')).toBe('fid A')
  })

  it('loads a single page after the count when everything fits in one', async () => {
    const fetchMock = mockGeoServer(42)
    const features = await fetchAllWfsFeatures('https://gs.example/wfs', 'ns:layer', { sortBy: 'fid' })
    expect(features).toHaveLength(42)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws when a page comes back short instead of returning a partial set', async () => {
    mockGeoServer(25_000, { dropFromPage: 10_000 })
    await expect(fetchAllWfsFeatures('https://gs.example/wfs', 'ns:layer', { pageSize: 10_000, sortBy: 'fid' }))
      .rejects.toThrow('loaded 24999 of 25000')
  })

  it('throws when pages overlap instead of returning duplicated rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      type: 'FeatureCollection', numberMatched: 2,
      features: [{ type: 'Feature', geometry: null, properties: { fid: 1 } }, { type: 'Feature', geometry: null, properties: { fid: 1 } }],
    }), { status: 200 })))
    await expect(fetchAllWfsFeatures('https://gs.example/wfs', 'ns:layer', { sortBy: 'fid' }))
      .rejects.toThrow('pages overlapped')
  })

  it('throws when the server does not report numberMatched', async () => {
    mockGeoServer(10, { withNumberMatched: false })
    await expect(fetchAllWfsFeatures('https://gs.example/wfs', 'ns:layer', { sortBy: 'fid' }))
      .rejects.toThrow('no numberMatched')
  })
})
