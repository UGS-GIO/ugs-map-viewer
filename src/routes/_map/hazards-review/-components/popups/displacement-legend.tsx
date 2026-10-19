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
import { getZeroBound, magnitudeLabel, type SldBin } from './displacement-sld-legend'
import { HatchSwatch } from './displacement-chart-hover'

/**
 * `layerLegendRender` for the hazards-review layer list. Replaces the default
 * flat WMS GetLegendGraphic image with a legend split into Uplift / Subsidence
 * columns, reusing the same swatch-grid presentation as the UCRC symbology
 * legend (`LegendSwatchGrid`) — just without the checkbox/toggle wiring, since
 * these are WMS raster classes, not a filterable vector field.
 */
export function renderDisplacementLegend(layer: LayerProps): React.ReactNode {
    const title = layer.title
    if (!title || !isDisplacementLayerTitle(title)) return null
    const typeValue = DISPLACEMENT_LAYER_TYPES[title]
    return <DisplacementLegend typeValue={typeValue} />
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

    // Deadband bound from the shared, hardened helper (returns null when the SLD
    // has no parseable Zero rule) rather than re-deriving it inline.
    const zeroBound = useMemo(() => getZeroBound(bins), [bins])
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
        <div className="flex flex-col gap-1.5 px-1 py-1">
            {/* Header carries the units inline so they don't need their own line. */}
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vertical Displacement</span>
                <span className="text-[11px] italic text-muted-foreground">{getUnitsLabelForType(typeValue)}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 text-xs text-foreground">
                <LegendGroup label="Uplift" bins={upliftBins} unit={unit} />
                <LegendGroup label="Subsidence" bins={subsidenceBins} unit={unit} />
            </div>
            {/* Map-reading footnotes on one compact, wrapping row: the hatch key
                (135deg so the swatch leans the same way as the SLD's shape://slash)
                + the within-error band. Keeps the legend short vertically. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                    <HatchSwatch />
                    Hatched = low quality, confirmed
                </span>
                {zeroBound != null && (
                    <span>0–{zeroBound} {unit} within error</span>
                )}
            </div>
        </div>
    )
}
