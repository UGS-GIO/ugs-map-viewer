import { Spinner } from '@/components/ui/loading-spinner'
import { Button } from '@/components/ui/button'
import { MousePointerClick } from 'lucide-react'

interface BoxSelectOverlayProps {
  isLoading?: boolean
  boxSize?: number
  isZoomValid?: boolean
  minZoom?: number
  onConfirm?: () => void
}

export function BoxSelectOverlay({
  isLoading = false,
  boxSize = 200,
  isZoomValid = true,
  minZoom = 7,
  onConfirm,
}: BoxSelectOverlayProps) {
  const borderColor = !isZoomValid ? 'border-yellow-500' : 'border-primary'
  const bgColor = !isZoomValid ? 'bg-yellow-500/10' : 'bg-primary/10'
  const lineColor = !isZoomValid ? 'bg-yellow-500/50' : 'bg-primary/50'
  const canSelect = isZoomValid && !isLoading

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
      <div
        className={`relative border-2 ${borderColor} ${bgColor}`}
        style={{ width: boxSize, height: boxSize }}
      >
        {/* Corner markers */}
        <div className={`absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 ${borderColor}`} />
        <div className={`absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 ${borderColor}`} />
        <div className={`absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 ${borderColor}`} />
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 ${borderColor}`} />

        {/* Center crosshair lines */}
        <div className={`absolute top-1/2 left-0 right-0 h-px ${lineColor}`} />
        <div className={`absolute left-1/2 top-0 bottom-0 w-px ${lineColor}`} />

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size="md" />
          </div>
        )}
      </div>

      {/* Select button - below the box so it doesn't obscure content */}
      {canSelect && (
        <div
          className="absolute pointer-events-auto"
          style={{ top: `calc(50% + ${boxSize / 2}px + 12px)` }}
        >
          <Button
            onClick={onConfirm}
            size="sm"
            className="gap-1.5 shadow-lg"
          >
            <MousePointerClick className="h-4 w-4" />
            Select
          </Button>
        </div>
      )}

      {/* Instructions */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 text-white text-sm rounded-lg ${
        !isZoomValid ? 'bg-yellow-600' : 'bg-black/70'
      }`}>
        {!isZoomValid
          ? `Zoom to level ${minZoom}+ to select`
          : isLoading
            ? 'Selecting features...'
            : 'Pan to position, then click Select'
        }
      </div>
    </div>
  )
}
