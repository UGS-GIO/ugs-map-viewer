// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseCapabilitiesExtent } from '../use-layer-extent'

const wrap = (layers: string) => `<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms">
  <Capability>
    <Layer>
      <Title>Root</Title>
      ${layers}
    </Layer>
  </Capability>
</WMS_Capabilities>`

describe('parseCapabilitiesExtent', () => {
    it('prefers CRS:84 (lon/lat order, no swap)', () => {
        const xml = wrap(`
            <Layer>
                <Name>ns:roads</Name>
                <BoundingBox CRS="CRS:84" minx="-114" miny="37" maxx="-109" maxy="42"/>
                <BoundingBox CRS="EPSG:4326" minx="37" miny="-114" maxx="42" maxy="-109"/>
            </Layer>`)
        expect(parseCapabilitiesExtent(xml, 'ns:roads')).toEqual([-114, 37, -109, 42])
    })

    it('falls back to EPSG:4326 and swaps lat/lon axis order', () => {
        const xml = wrap(`
            <Layer>
                <Name>ns:roads</Name>
                <BoundingBox CRS="EPSG:4326" minx="37" miny="-114" maxx="42" maxy="-109"/>
            </Layer>`)
        // EPSG:4326 in 1.3.0 is lat/lon -> swapped to [lon, lat, lon, lat]
        expect(parseCapabilitiesExtent(xml, 'ns:roads')).toEqual([-114, 37, -109, 42])
    })

    it('falls back to EX_GeographicBoundingBox', () => {
        const xml = wrap(`
            <Layer>
                <Name>ns:roads</Name>
                <EX_GeographicBoundingBox>
                    <westBoundLongitude>-114</westBoundLongitude>
                    <southBoundLatitude>37</southBoundLatitude>
                    <eastBoundLongitude>-109</eastBoundLongitude>
                    <northBoundLatitude>42</northBoundLatitude>
                </EX_GeographicBoundingBox>
            </Layer>`)
        expect(parseCapabilitiesExtent(xml, 'ns:roads')).toEqual([-114, 37, -109, 42])
    })

    it('finds a deeply nested layer by name', () => {
        const xml = wrap(`
            <Layer>
                <Name>group</Name>
                <Layer>
                    <Name>ns:roads</Name>
                    <BoundingBox CRS="CRS:84" minx="-114" miny="37" maxx="-109" maxy="42"/>
                </Layer>
            </Layer>`)
        expect(parseCapabilitiesExtent(xml, 'ns:roads')).toEqual([-114, 37, -109, 42])
    })

    it('returns null when layer name is absent', () => {
        const xml = wrap(`
            <Layer>
                <Name>ns:other</Name>
                <BoundingBox CRS="CRS:84" minx="-114" miny="37" maxx="-109" maxy="42"/>
            </Layer>`)
        expect(parseCapabilitiesExtent(xml, 'ns:roads')).toBeNull()
    })

    it('returns null for malformed XML', () => {
        expect(parseCapabilitiesExtent('<not-closed', 'ns:roads')).toBeNull()
    })
})
