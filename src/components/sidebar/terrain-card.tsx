import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useAppTerrain } from '@/hooks/use-app-terrain'
import { useIsMobile } from '@/hooks/use-mobile'
import { EXAGGERATION } from '@/lib/terrain'

export function TerrainCard() {
  const { terrain, setTerrain, exaggeration, setExaggeration } = useAppTerrain()
  const isMobile = useIsMobile()

  return (
    <Card>
      <CardHeader>
        <CardTitle>3D Terrain</CardTitle>
        <CardDescription>
          {isMobile
            ? 'Drag two fingers up or down to tilt, twist to rotate. Tap the compass to reset.'
            : 'Right-drag or Ctrl+drag to tilt and rotate. Click the compass to reset.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="terrain-toggle">Show 3D terrain</Label>
          <Switch id="terrain-toggle" checked={terrain} onCheckedChange={setTerrain} />
        </div>
        {terrain && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label id="exaggeration-label">Vertical exaggeration</Label>
              <span className="text-sm tabular-nums text-muted-foreground">{exaggeration}×</span>
            </div>
            <Slider
              aria-labelledby="exaggeration-label"
              min={EXAGGERATION.min}
              max={EXAGGERATION.max}
              step={EXAGGERATION.step}
              value={[exaggeration]}
              onValueChange={([v]) => setExaggeration(v)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
