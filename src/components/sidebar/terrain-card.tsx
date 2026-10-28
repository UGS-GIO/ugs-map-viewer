import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAppTerrain } from '@/hooks/use-app-terrain'
import { useIsMobile } from '@/hooks/use-mobile'

export function TerrainCard() {
  const { terrain, setTerrain } = useAppTerrain()
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
      <CardContent className="flex items-center justify-between gap-2">
        <Label htmlFor="terrain-toggle">Show 3D terrain</Label>
        <Switch id="terrain-toggle" checked={terrain} onCheckedChange={setTerrain} />
      </CardContent>
    </Card>
  )
}
