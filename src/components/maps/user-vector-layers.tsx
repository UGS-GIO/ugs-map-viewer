/**
 * The fill + line + circle triple every user-added vector layer renders as.
 *
 * User layers carry no authored symbology, so one generic set of sublayers,
 * filtered by geometry type, handles mixed geometry in a single source. It is
 * shared rather than repeated because the GeoJSON and tiled-Parquet sources
 * differ only in their source type and metadata flag — and when the paint lived
 * in both, the two copies drifted.
 */
import { Layer } from 'react-map-gl/maplibre'
import type maplibregl from 'maplibre-gl'

/** Default opacity per sublayer, used when the layer sets none. */
const FILL_OPACITY = 0.35
const LINE_WIDTH = 1.4
const CIRCLE_RADIUS = 4

/** Geometry-type filters, cast once here rather than at every call site. */
const POLYGON_ONLY = ['==', ['geometry-type'], 'Polygon'] as unknown as maplibregl.FilterSpecification
const POINT_ONLY = ['==', ['geometry-type'], 'Point'] as unknown as maplibregl.FilterSpecification

/** Paint for a PMTiles style fragment, which is JSON rather than JSX. Kept here
 *  so the three renderings of a user layer cannot disagree. */
export const userVectorPaint = (color: string) => ({
    fill: { 'fill-color': color, 'fill-opacity': FILL_OPACITY },
    line: { 'line-color': color, 'line-width': LINE_WIDTH },
    circle: {
        'circle-radius': CIRCLE_RADIUS,
        'circle-color': color,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
    },
})

export interface UserVectorLayersProps {
    /** Canonical layer id; the line sublayer takes it, so `beforeId` lookups resolve. */
    primaryId: string
    sourceId: string
    /** Vector sources need the tile's layer name; a GeoJSON source has none. */
    sourceLayer?: string
    color: string
    opacity?: number
    hidden?: boolean
    beforeId?: string
    /** Tagged onto each sublayer so picking can find them by layer title. */
    metadata: Record<string, unknown>
}

export function UserVectorLayers({
    primaryId, sourceId, sourceLayer, color, opacity, hidden, beforeId, metadata,
}: UserVectorLayersProps) {
    const visibility = hidden ? 'none' : 'visible'
    const paint = userVectorPaint(color)
    // `source-layer` is only valid on a vector source, so it is spread in.
    const sourceLayerProp = sourceLayer ? { 'source-layer': sourceLayer } : {}

    return (
        <>
            <Layer
                id={`${primaryId}-fill`}
                beforeId={beforeId}
                type="fill"
                source={sourceId}
                {...sourceLayerProp}
                filter={POLYGON_ONLY}
                layout={{ visibility }}
                paint={{ ...paint.fill, 'fill-opacity': opacity ?? FILL_OPACITY }}
                metadata={metadata}
            />
            <Layer
                id={primaryId}
                beforeId={beforeId}
                type="line"
                source={sourceId}
                {...sourceLayerProp}
                layout={{ visibility }}
                paint={{ ...paint.line, 'line-opacity': opacity ?? 1 }}
                metadata={metadata}
            />
            <Layer
                id={`${primaryId}-circle`}
                beforeId={beforeId}
                type="circle"
                source={sourceId}
                {...sourceLayerProp}
                filter={POINT_ONLY}
                layout={{ visibility }}
                paint={{ ...paint.circle, 'circle-opacity': opacity ?? 1 }}
                metadata={metadata}
            />
        </>
    )
}
