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
        <CardDescription>Multiply map layers over the basemap, so terrain and labels show through.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <Label htmlFor="basemap-blend-toggle">Blend with basemap</Label>
        <Switch id="basemap-blend-toggle" checked={blend} onCheckedChange={setBlend} />
      </CardContent>
    </Card>
  )
}
