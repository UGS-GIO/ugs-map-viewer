/**
 * "Add layer" dialog — lets a user add a map layer at runtime.
 *
 * Three ways in:
 *  - By URL: PMTiles / GeoJSON / WMS / COG (format sniffed from the URL).
 *  - Upload: a local GeoJSON, PMTiles, or COG file (persisted to IndexedDB).
 *  - STAC: browse the UGS warehouse catalog or any generic STAC endpoint, or enter a STAC item id / URL.
 *
 * Remote layers are added as shareable `?userLayers=` recipes; uploads persist
 * to IndexedDB. Either way the new layer is auto-selected so it shows at once.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    Plus, Upload, Link as LinkIcon, Database, Loader2, Folder, ArrowLeft,
    RotateCcw, Search, Check, Globe
} from 'lucide-react'
import { toast } from 'sonner'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useUserLayers } from '@/context/user-layers-provider'
import { useLayerUrl } from '@/context/layer-url-provider'
import {
    buildLayerFromUrl, buildLayerFromFile, detectFormatFromUrl, titleFromUrl,
    type DetectedFormat,
} from '@/lib/map/user-layers/detect'
import {
    DEFAULT_STAC_CATALOG_URL, fetchStacNode, isStacCatalogOrCollection,
    type StacCatalogNode, type StacItemSummary, type StacNode
} from '@/lib/map/user-layers/stac-explorer'

const FORMAT_LABEL: Record<DetectedFormat, string> = {
    pmtiles: 'PMTiles',
    geojson: 'GeoJSON',
    cog: 'COG (GeoTIFF)',
    wms: 'WMS',
    stac: 'STAC / JSON',
    unknown: 'Unknown',
}

export function AddLayerDialog() {
    const [open, setOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'url' | 'upload' | 'stac'>('url')
    const { addRemoteLayer, addUploadedLayer } = useUserLayers()
    const { updateLayerSelection } = useLayerUrl()

    // Shared submit state
    const [busy, setBusy] = useState(false)

    // By-URL tab
    const [url, setUrl] = useState('')
    const [wmsLayerName, setWmsLayerName] = useState('')
    const detected = url.trim() ? detectFormatFromUrl(url.trim()) : null

    // STAC tab state
    const [stacInput, setStacInput] = useState(DEFAULT_STAC_CATALOG_URL)
    const [stacNode, setStacNode] = useState<StacNode | null>(null)
    const [stacHistory, setStacHistory] = useState<StacCatalogNode[]>([])
    const [stacLoading, setStacLoading] = useState(false)
    const [selectedItem, setSelectedItem] = useState<StacItemSummary | null>(null)
    const [itemFilter, setItemFilter] = useState('')

    const finishAndSelect = (title: string) => {
        updateLayerSelection(title, true)
        toast.success(`Added "${title}"`)
        setOpen(false)
        setUrl('')
        setWmsLayerName('')
        setSelectedItem(null)
    }

    const loadStacEndpoint = useCallback(async (targetUrl: string, pushHistory = true) => {
        setStacLoading(true)
        try {
            const node = await fetchStacNode(targetUrl)
            if (node.kind === 'item') {
                setSelectedItem({
                    id: node.id,
                    title: node.title,
                    href: node.url,
                    format: node.format,
                })
                setStacNode(node)
            } else {
                if (pushHistory && stacNode && isStacCatalogOrCollection(stacNode)) {
                    setStacHistory(prev => [...prev, stacNode])
                }
                setStacNode(node)
                setSelectedItem(null)
                setItemFilter('')
                setStacInput(node.url)
            }
        } catch (e) {
            toast.error('Could not load STAC endpoint', {
                description: e instanceof Error ? e.message : String(e),
            })
        } finally {
            setStacLoading(false)
        }
    }, [stacNode])

    // Auto-load root catalog when opening STAC tab if not loaded yet
    useEffect(() => {
        if (open && activeTab === 'stac' && !stacNode && !stacLoading) {
            loadStacEndpoint(DEFAULT_STAC_CATALOG_URL, false)
        }
    }, [open, activeTab, stacNode, stacLoading, loadStacEndpoint])

    const handleBack = useCallback(() => {
        if (stacHistory.length === 0) return
        const prev = stacHistory[stacHistory.length - 1]
        setStacHistory(h => h.slice(0, -1))
        setStacNode(prev)
        setSelectedItem(null)
        setItemFilter('')
        setStacInput(prev.url)
    }, [stacHistory])

    const handleResetToWarehouse = useCallback(() => {
        setStacHistory([])
        setStacInput(DEFAULT_STAC_CATALOG_URL)
        loadStacEndpoint(DEFAULT_STAC_CATALOG_URL, false)
    }, [loadStacEndpoint])

    const handleAddUrl = async () => {
        const raw = url.trim()
        if (!raw) return
        setBusy(true)
        try {
            const format = detectFormatFromUrl(raw)

            // If a generic STAC catalog or collection was pasted in the URL tab, route to STAC tab
            if (format === 'stac' || raw.includes('/stac/') || raw.endsWith('catalog.json') || raw.endsWith('collection.json')) {
                try {
                    const node = await fetchStacNode(raw)
                    if (isStacCatalogOrCollection(node)) {
                        toast.info(`Opened STAC catalog "${node.title}" in STAC tab`)
                        setStacNode(node)
                        setStacHistory([])
                        setStacInput(node.url)
                        setActiveTab('stac')
                        setBusy(false)
                        return
                    }
                } catch {
                    // Fall through to regular buildLayerFromUrl
                }
            }

            // Pre-validate by building once so a bad URL never lands in the shareable link.
            await buildLayerFromUrl(raw, { format, wmsLayerName: wmsLayerName.trim() || undefined })
            const title = addRemoteLayer({
                url: raw,
                title: titleFromUrl(raw),
                format,
                wmsLayerName: wmsLayerName.trim() || undefined,
            })
            finishAndSelect(title)
        } catch (e) {
            toast.error('Could not add layer', { description: e instanceof Error ? e.message : String(e) })
        } finally {
            setBusy(false)
        }
    }

    const handleAddStac = async () => {
        // If an item is selected from the catalog browser:
        if (selectedItem) {
            setBusy(true)
            try {
                await buildLayerFromUrl(selectedItem.href)
                const title = addRemoteLayer({
                    url: selectedItem.href,
                    title: selectedItem.title,
                    format: 'stac',
                })
                finishAndSelect(title)
            } catch (e) {
                toast.error('Could not add STAC layer', {
                    description: e instanceof Error ? e.message : String(e),
                })
            } finally {
                setBusy(false)
            }
            return
        }

        // If the user typed an endpoint/id and pressed Add:
        const raw = stacInput.trim()
        if (!raw) return
        setBusy(true)
        try {
            const node = await fetchStacNode(raw)
            if (node.kind === 'item') {
                await buildLayerFromUrl(node.url)
                const title = addRemoteLayer({
                    url: node.url,
                    title: node.title,
                    format: 'stac',
                })
                finishAndSelect(title)
            } else {
                // It's a catalog / collection — explore it!
                setStacNode(node)
                setStacHistory([])
                setSelectedItem(null)
                setItemFilter('')
                toast.info(`Loaded ${node.kind}: ${node.title}`)
            }
        } catch (e) {
            toast.error('Could not load STAC', {
                description: e instanceof Error ? e.message : String(e),
            })
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

    const filteredItems = useMemo(() => {
        if (!stacNode || !isStacCatalogOrCollection(stacNode)) return []
        const q = itemFilter.trim().toLowerCase()
        if (!q) return stacNode.items
        return stacNode.items.filter(
            it => it.title.toLowerCase().includes(q) || it.id.toLowerCase().includes(q),
        )
    }, [stacNode, itemFilter])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full my-2 gap-1.5">
                    <Plus className="h-4 w-4" /> Add layer
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-4 sm:p-6">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Add a layer</DialogTitle>
                    <DialogDescription>
                        Add data by URL, upload a file, or explore warehouse and generic STAC catalogs.
                        URL &amp; STAC layers are saved in the shareable link; uploads stay in this browser.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'url' | 'upload' | 'stac')} className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-3 shrink-0">
                        <TabsTrigger value="url" className="gap-1.5"><LinkIcon className="h-3.5 w-3.5" /> URL</TabsTrigger>
                        <TabsTrigger value="upload" className="gap-1.5"><Upload className="h-3.5 w-3.5" /> Upload</TabsTrigger>
                        <TabsTrigger value="stac" className="gap-1.5"><Database className="h-3.5 w-3.5" /> STAC</TabsTrigger>
                    </TabsList>

                    {/* By URL */}
                    <TabsContent value="url" className="space-y-3 pt-2 shrink-0">
                        <div className="space-y-1.5">
                            <Label htmlFor="add-layer-url">Data URL</Label>
                            <Input
                                id="add-layer-url"
                                placeholder="https://…/layer.pmtiles | .geojson | .tif | WMS endpoint | catalog.json"
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
                    <TabsContent value="upload" className="space-y-3 pt-2 shrink-0">
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
                    <TabsContent value="stac" className="flex-1 flex flex-col min-h-0 space-y-2.5 pt-2 overflow-hidden">
                        {/* Endpoint Input */}
                        <div className="space-y-1 shrink-0">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="add-layer-stac" className="text-xs font-medium">STAC Catalog, Collection, or Item</Label>
                                {stacInput !== DEFAULT_STAC_CATALOG_URL && (
                                    <button
                                        type="button"
                                        onClick={handleResetToWarehouse}
                                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                                    >
                                        <RotateCcw className="h-3 w-3" /> Reset to UGS Warehouse
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-1.5">
                                <Input
                                    id="add-layer-stac"
                                    placeholder="https://…/catalog.json | item id | https://…/item.json"
                                    value={stacInput}
                                    onChange={e => setStacInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !stacLoading && !busy) {
                                            loadStacEndpoint(stacInput, true)
                                        }
                                    }}
                                    className="h-8 text-xs font-mono"
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => loadStacEndpoint(stacInput, true)}
                                    disabled={stacLoading || busy || !stacInput.trim()}
                                    className="h-8 shrink-0 px-3 text-xs"
                                >
                                    {stacLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Explore'}
                                </Button>
                            </div>
                        </div>

                        {/* Explorer Body */}
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            {stacLoading ? (
                                <div className="flex-1 py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                    <span className="text-xs">Loading STAC node...</span>
                                </div>
                            ) : stacNode && isStacCatalogOrCollection(stacNode) ? (
                                <div className="flex-1 flex flex-col min-h-0 space-y-2 overflow-hidden">
                                    {/* Catalog / Collection Header Bar */}
                                    <div className="flex items-center justify-between gap-2 border-b pb-1.5 shrink-0">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {stacHistory.length > 0 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleBack}
                                                    className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                                >
                                                    <ArrowLeft className="h-3.5 w-3.5 mr-0.5" /> Back
                                                </Button>
                                            )}
                                            <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                                            <span className="text-xs font-semibold truncate">{stacNode.title}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                                            {stacNode.kind}
                                        </Badge>
                                    </div>

                                    {/* Sub-collections / Sub-catalogs */}
                                    {stacNode.children.length > 0 && (
                                        <div className="space-y-1 shrink-0">
                                            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                                Collections ({stacNode.children.length})
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-muted/30 rounded border">
                                                {stacNode.children.map(child => (
                                                    <button
                                                        key={child.href}
                                                        type="button"
                                                        onClick={() => loadStacEndpoint(child.href)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background hover:bg-muted text-xs font-medium border text-foreground transition-colors shadow-sm"
                                                    >
                                                        <Folder className="h-3 w-3 text-muted-foreground shrink-0" />
                                                        <span className="truncate max-w-[180px]">{child.title}</span>
                                                        {(child.mappableCount ?? child.itemCount) !== undefined && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                ({child.mappableCount ?? child.itemCount})
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items / Layers */}
                                    {stacNode.items.length > 0 ? (
                                        <div className="flex-1 flex flex-col min-h-0 space-y-1.5 overflow-hidden">
                                            <div className="flex items-center justify-between shrink-0">
                                                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                                    Layers ({stacNode.items.length})
                                                </span>
                                                {selectedItem && (
                                                    <span className="text-[11px] text-primary truncate max-w-[220px]">
                                                        Selected: <strong>{selectedItem.title}</strong>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="relative shrink-0">
                                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                <Input
                                                    placeholder={`Search ${stacNode.items.length} layers...`}
                                                    value={itemFilter}
                                                    onChange={e => setItemFilter(e.target.value)}
                                                    className="pl-8 h-8 text-xs"
                                                />
                                            </div>

                                            <div className="flex-1 overflow-y-auto divide-y rounded border bg-card min-h-[120px]">
                                                {filteredItems.length === 0 ? (
                                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                                        No matching layers found
                                                    </div>
                                                ) : (
                                                    filteredItems.map(item => {
                                                        const isSelected = selectedItem?.href === item.href
                                                        return (
                                                            <div
                                                                key={item.href}
                                                                onClick={() => setSelectedItem(item)}
                                                                onDoubleClick={() => {
                                                                    setSelectedItem(item)
                                                                    handleAddStac()
                                                                }}
                                                                className={`p-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                                                    isSelected
                                                                        ? 'bg-primary/10 border-l-2 border-l-primary font-medium'
                                                                        : 'hover:bg-muted/50'
                                                                }`}
                                                            >
                                                                <div className="flex-1 min-w-0 pr-2">
                                                                    <div className="text-foreground truncate">{item.title}</div>
                                                                    <div className="text-[10px] text-muted-foreground truncate">{item.id}</div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <Badge
                                                                        variant={item.format === 'pmtiles' ? 'default' : item.format === 'cog' ? 'secondary' : 'outline'}
                                                                        className="text-[9px] uppercase px-1.5 py-0"
                                                                    >
                                                                        {item.format}
                                                                    </Badge>
                                                                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    ) : stacNode.children.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-muted-foreground">
                                            No child collections or mappable items found in this catalog.
                                        </div>
                                    ) : null}
                                </div>
                            ) : stacNode && !isStacCatalogOrCollection(stacNode) ? (
                                <div className="p-3 border rounded bg-card space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold">{stacNode.title}</span>
                                        <Badge variant="secondary" className="text-[10px] uppercase">{stacNode.format}</Badge>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground font-mono truncate">{stacNode.url}</div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground gap-2">
                                    <Globe className="h-8 w-8 text-muted-foreground/60" />
                                    <span>Enter any STAC endpoint URL above to explore its collections and layers.</span>
                                </div>
                            )}
                        </div>

                        {/* Submit Action */}
                        <div className="pt-1 shrink-0">
                            <Button
                                className="w-full gap-1.5"
                                onClick={handleAddStac}
                                disabled={busy || stacLoading || (!selectedItem && !stacInput.trim())}
                            >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                {selectedItem
                                    ? `Add "${selectedItem.title}"`
                                    : stacNode && isStacCatalogOrCollection(stacNode)
                                    ? 'Select a layer above to add'
                                    : 'Add STAC layer'}
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
