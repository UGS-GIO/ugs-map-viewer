import { useWMSLegend } from '@/hooks/use-wms-legend'
import { PROD_GEOSERVER_URL } from '@/lib/constants'
import { HazardUnit } from '@/routes/_report/-utils/static-hazards-service'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { CompositeSymbolResult } from '@/lib/legend/symbolizers/line'

interface LayerInfo {
    id: string
    name: string
    url: string
}

/**
 * Custom legend item - used when legend data comes from non-WMS sources
 * Allows flexibility for any legend rendering approach
 */
export interface CustomLegendItem {
    label: string
    literalValue?: string
    description?: string | React.ReactNode
    html?: SVGSVGElement | CompositeSymbolResult
    [key: string]: any
}

interface ReportLegendProps {
    layers?: LayerInfo[]
    showUnitDescriptions?: boolean
    units?: HazardUnit[]
    // Custom legend items - use this instead of layers/units for custom legend data
    customItems?: CustomLegendItem[]
    layerName?: string
}

export function ReportLegend({
    layers = [],
    showUnitDescriptions = false,
    units = [],
    customItems,
    layerName
}: ReportLegendProps) {
    // If custom items provided, render them directly
    if (customItems && layerName) {
        return <CustomLegendRenderer items={customItems} layerName={layerName} />
    }

    // Otherwise render standard WMS-based legend
    return (
        <div className="space-y-6">
            {layers.map((layer) => (
                <LayerLegend
                    key={layer.id}
                    layerId={layer.id}
                    url={layer.url}
                    layerName={layer.name}
                    showUnitDescriptions={showUnitDescriptions}
                    units={units}
                />
            ))}
        </div>
    )
}

interface LayerLegendProps {
    layerId: string
    url: string
    layerName: string
    showUnitDescriptions: boolean
    units: HazardUnit[]
}

/**
 * Find matching unit using the literal value from WMS
 * Direct match against the HazardUnit field (which contains relate_id)
 */
function findMatchingUnit(
    literalValue: string | undefined,
    units: HazardUnit[]
): HazardUnit | undefined {
    if (!units || units.length === 0 || !literalValue) {
        return undefined
    }

    return units.find(u =>
        u.HazardUnit === literalValue ||
        u.HazardUnit?.toLowerCase() === literalValue.toLowerCase()
    )
}

function getSymbolHtml(symbolData: SVGSVGElement | CompositeSymbolResult | undefined): string {
    if (!symbolData) {
        return '';
    }

    // Check if it's the CompositeSymbolResult object (check for a unique property like isComposite)
    if (typeof symbolData === 'object' && 'isComposite' in symbolData && symbolData.html instanceof SVGSVGElement) {
        // Access the SVG element inside the composite object
        return symbolData.html.outerHTML;
    }

    // Check if it's a direct SVGSVGElement (for points/polygons)
    if (symbolData instanceof SVGSVGElement) {
        return symbolData.outerHTML;
    }

    // Fallback if it's neither
    console.warn("Unexpected symbol type in legend:", symbolData);
    return '';
}

function LayerLegend({ url, layerName, showUnitDescriptions, units }: LayerLegendProps) {
    const baseWmsUrl = `${PROD_GEOSERVER_URL}wms`
    const { preview, isLoading, error } = useWMSLegend(url, baseWmsUrl)

    if (isLoading) {
        return (
            <div className="space-y-2">
                <h4 className="font-semibold text-sm">{layerName}</h4>
                <div className="text-xs text-muted-foreground">Loading legend...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-2">
                <h4 className="font-semibold text-sm">{layerName}</h4>
                <div className="text-xs text-red-500">Error loading legend</div>
            </div>
        )
    }

    if (!preview || preview.length === 0) {
        return (
            <div className="space-y-2">
                <h4 className="font-semibold text-sm">{layerName}</h4>
                <div className="text-xs text-muted-foreground">No legend data available</div>
            </div>
        )
    }

    // Pre-compute matches once (only if showing descriptions)
    const matches = showUnitDescriptions
        ? preview.map(item => ({
            label: item.label,
            literal: item.literalValue,
            unit: findMatchingUnit(item.literalValue, units)
        }))
        : preview.map(item => ({ label: item.label, literal: item.literalValue, unit: undefined }))

    return (
        <div className="space-y-3">
            <h4 className="font-semibold">{layerName}</h4>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted">
                        <TableRow>
                            <TableHead className="text-left p-4 font-semibold w-20">Symbol</TableHead>
                            <TableHead className="text-left p-4 font-semibold w-20">Unit</TableHead>
                            {showUnitDescriptions && <TableHead className="text-left p-4 font-semibold">Description</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {preview.map((previewItem, index) => {
                            const wmsLabel = previewItem.label || ''
                            const literalValue = previewItem.literalValue
                            const matchingUnit = matches[index]?.unit
                            const symbolHtmlString = getSymbolHtml(previewItem.html);

                            return (
                                <TableRow key={index}>
                                    <TableCell className="p-4 align-center">
                                        {symbolHtmlString && (
                                            <span
                                                className="flex items-center justify-center w-8"
                                                dangerouslySetInnerHTML={{ __html: symbolHtmlString }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell className="p-4 text-sm align-center">
                                        <div>
                                            {wmsLabel}
                                            {literalValue && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    ID: {literalValue}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    {showUnitDescriptions && (
                                        <TableCell className="p-4 text-sm align-center">
                                            <div>
                                                {matchingUnit?.Description && matchingUnit.Description.replace(/<[^>]*>/g, '') !== wmsLabel ? (
                                                    <div>{matchingUnit.Description.replace(/<[^>]*>/g, '')}</div>
                                                ) : (
                                                    <div className="text-muted-foreground">
                                                        Detailed description not available for this unit
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

interface CustomLegendRendererProps {
    items: CustomLegendItem[]
    layerName: string
}

/**
 * Renders legend with custom items (not from WMS)
 * Same structure as LayerLegend but accepts pre-built legend items
 */
function CustomLegendRenderer({ items, layerName }: CustomLegendRendererProps) {
    if (!items || items.length === 0) {
        return (
            <div className="space-y-2">
                <h4 className="font-semibold text-sm">{layerName}</h4>
                <div className="text-xs text-muted-foreground">No legend data available</div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <h4 className="font-semibold">{layerName}</h4>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted">
                        <TableRow>
                            <TableHead className="text-left p-4 font-semibold w-20">Symbol</TableHead>
                            <TableHead className="text-left p-4 font-semibold w-20">Unit</TableHead>
                            <TableHead className="text-left p-4 font-semibold">Description</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => {
                            const symbolHtmlString = getSymbolHtml(item.html)

                            return (
                                <TableRow key={index}>
                                    <TableCell className="p-4 align-top">
                                        {symbolHtmlString && (
                                            <span
                                                className="flex items-center justify-center w-8"
                                                dangerouslySetInnerHTML={{ __html: symbolHtmlString }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell className="p-4 text-sm align-top">
                                        <div>
                                            {item.label}
                                            {item.literalValue && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    ID: {item.literalValue}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-4 text-sm align-top">
                                        {item.description && (
                                            <div>
                                                {typeof item.description === 'string' ? (
                                                    <p>{item.description}</p>
                                                ) : (
                                                    item.description
                                                )}
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}