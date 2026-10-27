import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAppTerrain } from '@/hooks/use-app-terrain'

export function TerrainCard() {
  const { terrain, setTerrain } = useAppTerrain()

  return (
    <Card>
      <CardHeader>
        <CardTitle>3D Terrain</CardTitle>
        <CardDescription>Tilt with right-drag or Ctrl+drag, or a two-finger drag on phones. Click the compass to reset.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <Label htmlFor="terrain-toggle">Show 3D terrain</Label>
        <Switch id="terrain-toggle" checked={terrain} onCheckedChange={setTerrain} />
      </CardContent>
    </Card>
  )
}
