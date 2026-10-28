import { area } from '@turf/area'
import { bboxClip } from '@turf/bbox-clip'
import polylabel from 'polylabel'
import type { BBox, Feature, FeatureCollection, Geometry, Point, Position } from 'geojson'

const toXY = ([x, y]: Position): [number, number] => [x, y]

function polygonsOf(geometry: Geometry): Position[][][] {
    if (geometry.type === 'Polygon') return [geometry.coordinates]
    if (geometry.type === 'MultiPolygon') return geometry.coordinates
    return []
}

/**
 * One label point per feature id, inside the part of the feature on screen.
 *
 * Tiles clip a polygon at their edges, so the source returns one piece per loaded tile and
 * labelling the polygons repeats the name in each. Here each piece is clipped to `bounds`
 * ([west, south, east, north]) and the feature is labelled once, at the pole of inaccessibility
 * of its largest visible piece, so the name stays in view as you zoom in.
 */
export function viewportLabelPoints(features: Feature[], bounds: BBox): FeatureCollection<Point> {
    // polylabel precision, in degrees: a thousandth of the view is well under a pixel
    const precision = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]) / 1000
    const best = new Map<string | number, { area: number; rings: Position[][]; feature: Feature }>()
    for (const feature of features) {
        if (feature.id == null) continue
        for (const rings of polygonsOf(feature.geometry)) {
            const clipped = bboxClip({ type: 'Polygon', coordinates: rings }, bounds).geometry
            for (const piece of polygonsOf(clipped)) {
                if (!piece[0] || piece[0].length < 4) continue
                const pieceArea = area({ type: 'Polygon', coordinates: piece })
                const prev = best.get(feature.id)
                if (!prev || pieceArea > prev.area) best.set(feature.id, { area: pieceArea, rings: piece, feature })
            }
        }
    }
    return {
        type: 'FeatureCollection',
        features: [...best.entries()].map(([id, { rings, feature }]) => ({
            type: 'Feature',
            id,
            // Tile features' properties have a null prototype, which MapLibre can't post to its worker
            properties: { ...feature.properties },
            geometry: { type: 'Point', coordinates: [...polylabel(rings.map(r => r.map(toXY)), precision)] },
        })),
    }
}
