import { useNavigate, useSearch } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export function TerrainCard() {
  const navigate = useNavigate()
  const { terrain } = useSearch({ from: '/_map' })

  const handleChange = (checked: boolean) => {
    navigate({
      to: '.',
      search: (prev) => ({ ...prev, terrain: checked || undefined }),
      replace: true,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>3D Terrain</CardTitle>
        <CardDescription>Ctrl+drag or drag the compass to tilt the map.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <Label htmlFor="terrain-toggle">Show 3D terrain</Label>
        <Switch id="terrain-toggle" checked={terrain ?? false} onCheckedChange={handleChange} />
      </CardContent>
    </Card>
  )
}
