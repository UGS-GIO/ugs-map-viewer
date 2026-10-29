import { area } from '@turf/area'
import { bboxClip } from '@turf/bbox-clip'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import polylabel from 'polylabel'
import type { GeoJSONSourceDiff } from 'maplibre-gl'
import type { BBox, Feature, FeatureCollection, Geometry, Point, Position } from 'geojson'

type FeatureId = string | number
export type LabelPoints = Map<FeatureId, Feature<Point>>

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
 * of its largest visible piece, so the name stays in view as you zoom in. A label from
 * `previous` that is still inside a visible piece stays put, so panning doesn't move it.
 */
export function viewportLabelPoints(features: Feature[], bounds: BBox, previous: LabelPoints = new Map()): LabelPoints {
    // polylabel precision, in degrees: a thousandth of the view is well under a pixel
    const precision = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]) / 1000
    const visible = new Map<FeatureId, { pieces: Position[][][]; feature: Feature }>()
    for (const feature of features) {
        if (feature.id == null) continue
        for (const rings of polygonsOf(feature.geometry)) {
            const clipped = bboxClip({ type: 'Polygon', coordinates: rings }, bounds).geometry
            for (const piece of polygonsOf(clipped)) {
                if (!piece[0] || piece[0].length < 4) continue
                const entry = visible.get(feature.id) ?? { pieces: [], feature }
                entry.pieces.push(piece)
                visible.set(feature.id, entry)
            }
        }
    }
    const out: LabelPoints = new Map()
    for (const [id, { pieces, feature }] of visible) {
        const prev = previous.get(id)
        if (prev && pieces.some(p => booleanPointInPolygon(prev.geometry, { type: 'Polygon', coordinates: p }))) {
            out.set(id, prev)
            continue
        }
        const largest = pieces.reduce((a, b) =>
            area({ type: 'Polygon', coordinates: b }) > area({ type: 'Polygon', coordinates: a }) ? b : a)
        out.set(id, {
            type: 'Feature',
            id,
            // Tile features' properties have a null prototype, which MapLibre can't post to its worker
            properties: { ...feature.properties },
            geometry: { type: 'Point', coordinates: [...polylabel(largest.map(r => r.map(toXY)), precision)] },
        })
    }
    return out
}

export function toFeatureCollection(labels: LabelPoints): FeatureCollection<Point> {
    return { type: 'FeatureCollection', features: [...labels.values()] }
}

/** The GeoJSON source diff from `prev` to `next`, or null when no label changed. */
export function labelDiff(prev: LabelPoints, next: LabelPoints): GeoJSONSourceDiff | null {
    const remove = [...prev.keys()].filter(id => !next.has(id))
    const add = [...next.values()].filter(f => f.id != null && !prev.has(f.id))
    const update = [...next.values()].flatMap(f => {
        const old = f.id == null ? undefined : prev.get(f.id)
        return f.id != null && old && old !== f ? [{ id: f.id, newGeometry: f.geometry }] : []
    })
    return remove.length || add.length || update.length ? { remove, add, update } : null
}
