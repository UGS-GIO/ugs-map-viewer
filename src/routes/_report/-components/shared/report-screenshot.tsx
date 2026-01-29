import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapScreenshot } from '@/routes/_report/-hooks/use-map-screenshot'

interface ReportScreenshotProps {
    title?: string
    polygon?: string
    hazardCodes?: string[]
    height?: number
    tooltip?: React.ReactNode
}

export function ReportScreenshot({
    title = 'Map',
    polygon,
    hazardCodes = [],
    height = 400,
    tooltip
}: ReportScreenshotProps) {
    const { data, isLoading, error } = useMapScreenshot({
        polygon,
        hazardCodes,
        height
    })

    if (error) {
        return (
            <div className="border rounded-lg overflow-hidden shadow-sm">
                {title && (
                    <div className="bg-muted px-4 py-2 border-b">
                        <span className="font-semibold text-sm">{title}</span>
                    </div>
                )}
                <div style={{ height }} className="bg-muted/50 flex items-center justify-center">
                    <p className="text-sm text-destructive">Failed to load map</p>
                </div>
            </div>
        )
    }

    if (isLoading || !data) {
        return (
            <div className="relative border rounded-lg overflow-hidden shadow-sm isolate">
                {title && (
                    <div className="bg-muted px-4 py-2 border-b flex justify-between items-center">
                        <span className="font-semibold text-sm">{title}</span>
                        {tooltip && <div>{tooltip}</div>}
                    </div>
                )}
                <div style={{ height }} className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Capturing map...</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative overflow-hidden shadow-sm print-map-container">
            {/* Title Header */}
            {title && (
                <div className="bg-muted px-4 py-2 border-t border-x rounded-t-lg flex justify-between items-center">
                    <span className="font-semibold text-sm">{title}</span>
                    {tooltip && <div>{tooltip}</div>}
                </div>
            )}

            {/* MAP IMAGE AREA */}
            <div className="relative bg-secondary border-x" style={{ height }}>
                <img
                    src={data.dataUrl}
                    alt={title}
                    className="print-map-image w-full h-full object-contain block relative"
                />
            </div>

            {/* SCALE BAR */}
            {data.scaleInfo && (
                <div className="px-4 py-2 border-x border-b rounded-b-lg bg-muted">
                    <div className="text-xs flex items-center gap-2 flex-wrap">
                        <span className="text-foreground whitespace-nowrap">Scale:</span>
                        <div
                            style={{ width: data.scaleInfo.pixelWidth, minWidth: 30 }}
                            className="h-1 bg-muted-foreground border-t border-b border-muted flex-shrink-0"
                        />
                        <span className="text-foreground whitespace-nowrap">{data.scaleInfo.text}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
