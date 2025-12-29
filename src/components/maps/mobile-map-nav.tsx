import { Map as MapIcon, Table2, Layers, SplitSquareVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/hooks/use-map-url-sync'

interface MobileMapNavProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onOpenLayers: () => void
}

export function MobileMapNav({ viewMode, onViewModeChange, onOpenLayers }: MobileMapNavProps) {
  return (
    <div className="flex-shrink-0 bg-card border-t border-border px-2 py-2 z-40">
      <div className="flex justify-around items-center max-w-md mx-auto">
        <button
          onClick={() => onViewModeChange('map')}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
            viewMode === 'map' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MapIcon className="w-5 h-5" />
          <span className="text-xs font-medium">Map</span>
        </button>
        <button
          onClick={() => onViewModeChange('split')}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
            viewMode === 'split' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <SplitSquareVertical className="w-5 h-5" />
          <span className="text-xs font-medium">Split</span>
        </button>
        <button
          onClick={() => onViewModeChange('table')}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
            viewMode === 'table' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Table2 className="w-5 h-5" />
          <span className="text-xs font-medium">Table</span>
        </button>
        <button
          onClick={onOpenLayers}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
        >
          <Layers className="w-5 h-5" />
          <span className="text-xs font-medium">Layers</span>
        </button>
      </div>
    </div>
  )
}
