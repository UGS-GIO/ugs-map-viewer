/**
 * "Add layer" dialog — lets a user add a map layer at runtime.
 *
 * Three ways in:
 *  - By URL: PMTiles / GeoJSON / WMS / COG (format sniffed from the URL).
 *  - Upload: a local GeoJSON file (stored in browser IndexedDB).
 *  - STAC: a warehouse serving-topics item id (or a direct STAC item URL).
 *
 * Remote layers are added as shareable `?userLayers=` recipes; uploads persist
 * to IndexedDB. Either way the new layer is auto-selected so it shows at once.
 */
import { useState } from 'react'
import { Plus, Upload, Link as LinkIcon, Database, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUserLayers } from '@/context/user-layers-provider'
import { useLayerUrl } from '@/context/layer-url-provider'
import { buildLayerFromUrl, buildLayerFromFile, detectFormatFromUrl, titleFromUrl, type DetectedFormat } from '@/lib/map/user-layers/detect'

const FORMAT_LABEL: Record<DetectedFormat, string> = {
    pmtiles: 'PMTiles', geojson: 'GeoJSON', cog: 'COG (GeoTIFF)', wms: 'WMS', stac: 'STAC / JSON', unknown: 'Unknown',
}

export function AddLayerDialog() {
    const [open, setOpen] = useState(false)
    const { addRemoteLayer, addUploadedLayer } = useUserLayers()
    const { updateLayerSelection } = useLayerUrl()

    // Shared submit state
    const [busy, setBusy] = useState(false)

    // By-URL tab
    const [url, setUrl] = useState('')
    const [wmsLayerName, setWmsLayerName] = useState('')
    const detected = url.trim() ? detectFormatFromUrl(url.trim()) : null

    // STAC tab
    const [stacId, setStacId] = useState('')

    const finishAndSelect = (title: string) => {
        updateLayerSelection(title, true)
        toast.success(`Added "${title}"`)
        setOpen(false)
        setUrl(''); setWmsLayerName(''); setStacId('')
    }

    const handleAddUrl = async () => {
        const raw = url.trim()
        if (!raw) return
        setBusy(true)
        try {
            const format = detectFormatFromUrl(raw)
            // Pre-validate by building once so a bad URL never lands in the shareable link.
            await buildLayerFromUrl(raw, { format, wmsLayerName: wmsLayerName.trim() || undefined })
            const title = addRemoteLayer({ url: raw, title: titleFromUrl(raw), format, wmsLayerName: wmsLayerName.trim() || undefined })
            finishAndSelect(title)
        } catch (e) {
            toast.error('Could not add layer', { description: e instanceof Error ? e.message : String(e) })
        } finally {
            setBusy(false)
        }
    }

    const handleAddStac = async () => {
        const raw = stacId.trim()
        if (!raw) return
        setBusy(true)
        try {
            await buildLayerFromUrl(raw)
            const title = addRemoteLayer({ url: raw, title: raw, format: 'stac' })
            finishAndSelect(title)
        } catch (e) {
            toast.error('Could not add STAC layer', { description: e instanceof Error ? e.message : String(e) })
        } finally {
            setBusy(false)
        }
    }

    const handleFile = async (file: File | undefined) => {
        if (!file) return
        setBusy(true)
        try {
            const idbKey = `upload-${crypto.randomUUID()}`
            const { def, file: fileToStore } = await buildLayerFromFile(file, idbKey)
            const title = await addUploadedLayer(def, fileToStore)
            finishAndSelect(title)
        } catch (e) {
            toast.error('Could not add file', { description: e instanceof Error ? e.message : String(e) })
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full my-2 gap-1.5">
                    <Plus className="h-4 w-4" /> Add layer
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add a layer</DialogTitle>
                    <DialogDescription>
                        Add data by URL, upload a GeoJSON file, or pull a warehouse STAC item.
                        URL &amp; STAC layers are saved in the shareable link; uploads stay in this browser.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="url">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="url" className="gap-1.5"><LinkIcon className="h-3.5 w-3.5" /> URL</TabsTrigger>
                        <TabsTrigger value="upload" className="gap-1.5"><Upload className="h-3.5 w-3.5" /> Upload</TabsTrigger>
                        <TabsTrigger value="stac" className="gap-1.5"><Database className="h-3.5 w-3.5" /> STAC</TabsTrigger>
                    </TabsList>

                    {/* By URL */}
                    <TabsContent value="url" className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="add-layer-url">Data URL</Label>
                            <Input
                                id="add-layer-url"
                                placeholder="https://…/layer.pmtiles | .geojson | .tif | WMS endpoint"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !busy) handleAddUrl() }}
                            />
                            {detected && (
                                <p className="text-xs text-muted-foreground">
                                    Detected: <span className="font-medium text-foreground">{FORMAT_LABEL[detected]}</span>
                                    {detected === 'unknown' && ' — not a recognized format'}
                                </p>
                            )}
                        </div>
                        {detected === 'wms' && (
                            <div className="space-y-1.5">
                                <Label htmlFor="add-layer-wms-name">WMS layer name <span className="text-muted-foreground">(workspace:layer)</span></Label>
                                <Input
                                    id="add-layer-wms-name"
                                    placeholder="e.g. hazards:qfaults"
                                    value={wmsLayerName}
                                    onChange={e => setWmsLayerName(e.target.value)}
                                />
                            </div>
                        )}
                        <Button className="w-full gap-1.5" onClick={handleAddUrl} disabled={busy || !url.trim() || detected === 'unknown'}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add layer
                        </Button>
                    </TabsContent>

                    {/* Upload */}
                    <TabsContent value="upload" className="space-y-3 pt-2">
                        <label
                            className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
                        >
                            {busy
                                ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                : <Upload className="h-6 w-6 text-muted-foreground" />}
                            <span className="text-sm text-muted-foreground">
                                Drop a GeoJSON, PMTiles or COG file here, or <span className="text-foreground font-medium">browse</span>
                            </span>
                            <span className="text-xs text-muted-foreground">.geojson / .json / .pmtiles / .tif — stored in this browser only</span>
                            <input
                                type="file"
                                accept=".geojson,.json,.pmtiles,.tif,.tiff,application/geo+json,application/json,image/tiff"
                                className="hidden"
                                onChange={e => handleFile(e.target.files?.[0])}
                            />
                        </label>
                    </TabsContent>

                    {/* STAC */}
                    <TabsContent value="stac" className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="add-layer-stac">STAC item id or URL</Label>
                            <Input
                                id="add-layer-stac"
                                placeholder="e.g. enmin_ucrc_wells  |  https://…/item.json"
                                value={stacId}
                                onChange={e => setStacId(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !busy) handleAddStac() }}
                            />
                            <p className="text-xs text-muted-foreground">Resolved against the warehouse serving-topics collection.</p>
                        </div>
                        <Button className="w-full gap-1.5" onClick={handleAddStac} disabled={busy || !stacId.trim()}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add layer
                        </Button>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
