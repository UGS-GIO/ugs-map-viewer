import { useMemo } from 'react'
import { createRasterSymbol } from '@/lib/legend/symbolizers/raster'
import { mountDomNode } from '@/lib/legend/mount-dom-node'
import { useCogRange } from '@/hooks/use-cog-metadata'
import type { COGLayerProps } from '@/lib/types/mapping-types'
import type { Symbolizer } from '@/lib/types/geoserver-types'

export function CogLegend({ layer }: { layer: COGLayerProps }) {
    const range = useCogRange(layer)

    const svg = useMemo(() => {
        if (!range) return null
        const [min, max] = range
        const n = layer.colorStops.length
        // Synthesize a GeoServer-shaped Symbolizer so we reuse createRasterSymbol's gradient + labels.
        const symbolizers: Symbolizer[] = [{
            Raster: {
                colormap: {
                    type: 'ramp',
                    entries: layer.colorStops.map((color, i) => ({
                        color,
                        quantity: String(min + ((max - min) * i) / (n - 1)),
                        opacity: '1',
                        label: '',
                    })),
                },
            },
        }]
        return createRasterSymbol(symbolizers, { unit: layer.legendUnit, range })
    }, [layer.colorStops, layer.legendUnit, range])

    if (!svg) return null
    return <span className="block px-0.5 py-1" ref={mountDomNode(svg)} />
}
