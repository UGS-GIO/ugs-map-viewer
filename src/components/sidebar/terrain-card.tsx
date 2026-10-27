import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAppTerrain } from '@/hooks/use-app-terrain'

const OPTIONS = [
  { key: 'terrain', label: 'Show 3D terrain' },
  { key: 'hillshade', label: 'Show hillshade' },
] as const

export function TerrainCard() {
  const settings = useAppTerrain()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Terrain</CardTitle>
        <CardDescription>In 3D, right-drag or Ctrl+drag to tilt and rotate. Click the compass to reset.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {OPTIONS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <Label htmlFor={`${key}-toggle`}>{label}</Label>
            <Switch id={`${key}-toggle`} checked={settings[key]} onCheckedChange={(checked) => settings.setSetting(key, checked)} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
