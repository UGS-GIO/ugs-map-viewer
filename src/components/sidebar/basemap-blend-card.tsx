import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useBasemapBlend } from '@/hooks/use-basemap-blend'

export function BasemapBlendCard() {
  const { blend, setBlend } = useBasemapBlend()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basemap Blending</CardTitle>
        <CardDescription>Show terrain shading and basemap labels through shaded map areas.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <Label htmlFor="basemap-blend-toggle">Blend with basemap</Label>
        <Switch id="basemap-blend-toggle" checked={blend} onCheckedChange={setBlend} />
      </CardContent>
    </Card>
  )
}
