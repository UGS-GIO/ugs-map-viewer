import { useMemo } from 'react'
import { LegendSwatchGrid } from '@/components/maps/legend-swatch-grid'
import type { LayerProps } from '@/lib/types/mapping-types'
import { useDisplacementSldBins } from './use-displacement-queries'
import {
    DISPLACEMENT_LAYER_TYPES,
    getShortUnitForType,
    getStyleNameForType,
    getUnitsLabelForType,
    isDisplacementLayerTitle,
    type DisplacementType,
} from './displacement-layers'
import { magnitudeLabel, type SldBin } from './displacement-sld-legend'

/**
 * Displacement legend resolved by layer title: a legend split into Uplift /
 * Subsidence columns, reusing the same swatch-grid presentation as the UCRC
 * symbology legend (`LegendSwatchGrid`) — just without the checkbox/toggle
 * wiring, since these are WMS raster classes, not a filterable vector field.
 *
 * Title-keyed rather than layer-keyed so callers that DERIVE a title can reuse
 * it — review-stac renders one PMTiles layer whose active displacement type
 * comes from filter state, so the title it needs isn't its own layer's title.
 */
export function renderDisplacementLegendForTitle(title: string): React.ReactNode {
    if (!isDisplacementLayerTitle(title)) return null
    return <DisplacementLegend typeValue={DISPLACEMENT_LAYER_TYPES[title]} />
}

/**
 * `layerLegendRender` for the hazards-review layer list. Replaces the default
 * flat WMS GetLegendGraphic image with the legend above.
 */
export function renderDisplacementLegend(layer: LayerProps): React.ReactNode {
    return renderDisplacementLegendForTitle(layer.title ?? '')
}

function toSwatchItems(bins: SldBin[], label: (b: SldBin) => string = b => b.title) {
    return bins.map(b => ({ key: b.name, label: label(b), color: b.color }))
}

function LegendGroup({ label, bins, unit }: { label: string; bins: SldBin[]; unit: string }) {
    if (bins.length === 0) return <div />
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            <LegendSwatchGrid items={toSwatchItems(bins, b => magnitudeLabel(b, unit))} columns="single" />
        </div>
    )
}

function DisplacementLegend({ typeValue }: { typeValue: DisplacementType }) {
    const styleName = getStyleNameForType(typeValue) ?? ''
    const { data: bins = [], isLoading } = useDisplacementSldBins(styleName)

    const zeroBin = useMemo(() => bins.find(b => b.isZero), [bins])
    // Same split + ordering as the chart's SignedLegendGroup: closest-to-zero
    // bin first within each side, deepest/highest band last.
    const subsidenceBins = useMemo(
        () => bins.filter(b => !b.isZero && b.max <= 0).sort((a, b) => b.max - a.max),
        [bins],
    )
    const upliftBins = useMemo(
        () => bins.filter(b => !b.isZero && b.min >= 0).sort((a, b) => a.min - b.min),
        [bins],
    )

    const unit = getShortUnitForType(typeValue)

    if (isLoading) return <div className="px-1 py-1 text-xs text-muted-foreground">Loading legend…</div>
    if (bins.length === 0) return null

    return (
        <div className="flex flex-col gap-2 px-1 py-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vertical Displacement</div>
            <div className="grid grid-cols-2 gap-x-3 text-xs text-foreground">
                <LegendGroup label="Uplift" bins={upliftBins} unit={unit} />
                <LegendGroup label="Subsidence" bins={subsidenceBins} unit={unit} />
            </div>
            {zeroBin && (
                <div className="border-t border-border/60 pt-1.5">
                    <LegendSwatchGrid items={toSwatchItems([zeroBin])} columns="single" />
                </div>
            )}
            <p className="text-xs italic text-muted-foreground">Units: {getUnitsLabelForType(typeValue)}.</p>
        </div>
    )
}
