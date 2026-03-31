import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from '@/components/ui/carousel'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { ChevronDown, ChevronUp, LayoutGrid, ArrowLeft, X } from 'lucide-react'

export interface GalleryImage {
    url: string
    thumbnailUrl?: string
    label?: string
    metadata?: { label: string; value: string }[]
}

interface PopupImageGalleryProps {
    images: GalleryImage[]
}

const GRID_VISIBLE = 5 // show 5 images; 6th cell is overflow button

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

function ImageTooltip({ img, children }: { img: GalleryImage; children: React.ReactNode }) {
    const hasContent = img.label || (img.metadata && img.metadata.length > 0)
    if (!hasContent) return <>{children}</>
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-48">
                {img.label && <p className="font-medium text-sm">{img.label}</p>}
                {img.metadata?.map(({ label, value }) => (
                    <p key={label} className="text-xs text-muted-foreground">
                        <span className="font-medium">{label}:</span> {value}
                    </p>
                ))}
            </TooltipContent>
        </Tooltip>
    )
}

export function PopupImageGallery({ images }: PopupImageGalleryProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const [metaOpen, setMetaOpen] = useState(false)
    const [gridView, setGridView] = useState(false)
    const apiRef = useRef<CarouselApi>(undefined)
    const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
    const backBtnRef = useRef<HTMLButtonElement>(null)
    const gridBtnRef = useRef<HTMLButtonElement>(null)

    const handleApiChange = (newApi: CarouselApi) => {
        if (!newApi) return
        apiRef.current = newApi
        // Scroll to activeIndex on mount (handles returning from grid view)
        newApi.scrollTo(activeIndex, true)
        setActiveIndex(newApi.selectedScrollSnap())
        newApi.on('select', () => setActiveIndex(newApi.selectedScrollSnap()))
    }

    // Auto-scroll thumbnail strip to keep active thumb centered
    useEffect(() => {
        if (gridView) return
        thumbRefs.current[activeIndex]?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
    }, [activeIndex, gridView])

    // Manage focus when switching views
    useEffect(() => {
        if (gridView) {
            backBtnRef.current?.focus()
        } else {
            gridBtnRef.current?.focus()
        }
    }, [gridView])

    const openAt = (i: number) => { setLightboxIndex(i); setActiveIndex(i); setMetaOpen(false); setGridView(false) }

    const selectFromGrid = (i: number) => {
        setActiveIndex(i)
        setMetaOpen(false)
        setGridView(false)
    }

    const handleClose = () => { setLightboxIndex(null); setMetaOpen(false); setGridView(false) }

    if (images.length === 0) return null

    const showOverflow = images.length > GRID_VISIBLE + 1
    const gridImages = showOverflow ? images.slice(0, GRID_VISIBLE) : images
    const overflowCount = images.length - GRID_VISIBLE

    const activeImage = lightboxIndex !== null ? images[activeIndex] : null
    const hasMeta = (activeImage?.metadata?.length ?? 0) > 0

    return (
        <TooltipProvider>
            {/* Thumbnail grid — 2 rows × 3 cols */}
            <div className="grid grid-cols-3 gap-1 p-0.5">
                {gridImages.map((img, i) => (
                    <ImageTooltip key={img.url} img={img}>
                        <button
                            onClick={() => openAt(i)}
                            aria-label={img.label || `Open image ${i + 1}`}
                            className={`relative aspect-[4/3] rounded-md border border-border hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-shadow overflow-hidden ${focusRing}`}
                        >
                            <img
                                src={img.thumbnailUrl ?? img.url}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        </button>
                    </ImageTooltip>
                ))}

                {/* Overflow cell */}
                {showOverflow && (
                    <button
                        onClick={() => openAt(GRID_VISIBLE)}
                        aria-label={`Show all ${images.length} photos`}
                        className={`relative aspect-[4/3] rounded-md border border-border hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-shadow overflow-hidden ${focusRing}`}
                    >
                        <img
                            src={images[GRID_VISIBLE].thumbnailUrl ?? images[GRID_VISIBLE].url}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold" aria-hidden>+{overflowCount}</span>
                        </div>
                    </button>
                )}
            </div>

            <Dialog open={lightboxIndex !== null} onOpenChange={(open) => { if (!open) handleClose() }}>
                <DialogContent
                    className="max-w-[95vw] sm:max-w-[90vw] h-[90svh] p-0 bg-background border-border overflow-hidden"
                    onKeyDown={(e: React.KeyboardEvent) => {
                        if (gridView) return
                        if (e.key === 'ArrowLeft') apiRef.current?.scrollPrev()
                        if (e.key === 'ArrowRight') apiRef.current?.scrollNext()
                    }}
                >
                    <VisuallyHidden>
                        <DialogTitle>
                            {lightboxIndex !== null ? (images[lightboxIndex].label || `Image ${lightboxIndex + 1}`) : 'Image'}
                        </DialogTitle>
                        <DialogDescription>Image gallery viewer</DialogDescription>
                    </VisuallyHidden>

                    <div className="flex flex-col max-h-[90svh] overflow-hidden">
                        {/* Header bar */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 gap-2">
                            {gridView ? (
                                <button
                                    ref={backBtnRef}
                                    onClick={() => setGridView(false)}
                                    className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md px-1 ${focusRing}`}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </button>
                            ) : (
                                <span className="text-sm text-muted-foreground">
                                    {activeIndex + 1} / {images.length}
                                    {images[activeIndex]?.label ? ` · ${images[activeIndex].label}` : ''}
                                </span>
                            )}
                            <div className="flex items-center gap-1 ml-auto">
                                {images.length > 1 && (
                                    <button
                                        ref={gridBtnRef}
                                        onClick={() => setGridView(v => !v)}
                                        aria-label="Toggle grid view"
                                        aria-pressed={gridView}
                                        className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors ${focusRing} ${gridView ? 'text-foreground bg-accent' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                    </button>
                                )}
                                <DialogClose className={`inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ${focusRing}`}>
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Close</span>
                                </DialogClose>
                            </div>
                        </div>

                        {gridView ? (
                            /* Contact sheet grid */
                            <div className="overflow-y-auto flex-1 p-3">
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {images.map((img, i) => (
                                        <ImageTooltip key={img.url} img={img}>
                                            <button
                                                onClick={() => selectFromGrid(i)}
                                                aria-label={img.label || `Select image ${i + 1}`}
                                                aria-current={activeIndex === i ? 'true' : undefined}
                                                className={`relative aspect-[4/3] rounded-md border transition-shadow overflow-hidden ${focusRing} ${activeIndex === i ? 'ring-2 ring-primary border-primary' : 'border-border hover:ring-2 hover:ring-primary hover:ring-offset-1 hover:ring-offset-background'}`}
                                            >
                                                <img
                                                    src={img.thumbnailUrl ?? img.url}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                                {img.label && (
                                                    <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1 py-0.5">
                                                        <p className="text-white text-[10px] truncate" aria-hidden>{img.label}</p>
                                                    </div>
                                                )}
                                            </button>
                                        </ImageTooltip>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Single image view */
                            <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
                                <div className="flex flex-col flex-1 min-h-0 min-w-0">
                                    <Carousel
                                        setApi={handleApiChange}
                                        opts={{ startIndex: activeIndex, loop: images.length > 1 }}
                                        className="flex-1 min-h-0 relative"
                                    >
                                        <CarouselContent>
                                            {images.map((img, i) => (
                                                <CarouselItem key={img.url} className="flex items-center justify-center">
                                                    <div className="flex flex-col items-center gap-2 p-4">
                                                        <img
                                                            src={img.url}
                                                            alt={img.label || `Image ${i + 1}`}
                                                            className="max-w-full max-h-[45svh] sm:max-h-[55svh] object-contain rounded"
                                                        />
                                                    </div>
                                                </CarouselItem>
                                            ))}
                                        </CarouselContent>
                                        {images.length > 1 && (
                                            <>
                                                <CarouselPrevious className="hidden sm:flex left-2 bg-accent hover:bg-accent/80 border-border text-accent-foreground" />
                                                <CarouselNext className="hidden sm:flex right-2 bg-accent hover:bg-accent/80 border-border text-accent-foreground" />
                                            </>
                                        )}
                                        {/* Grid toggle button — bottom-right corner of photo area */}
                                        {images.length > 1 && (
                                            <button
                                                onClick={() => setGridView(true)}
                                                className={`absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-black/50 hover:bg-black/70 px-2 py-1 text-white text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
                                                aria-label="Show all photos"
                                            >
                                                <LayoutGrid className="h-3 w-3" aria-hidden />
                                                All photos
                                            </button>
                                        )}
                                    </Carousel>

                                    {/* Thumbnail strip */}
                                    {images.length > 1 && (
                                        <div className="border-t border-border px-2 py-2 shrink-0">
                                            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                                                {images.map((img, i) => (
                                                    <ImageTooltip key={img.url} img={img}>
                                                        <button
                                                            ref={el => { thumbRefs.current[i] = el }}
                                                            onClick={() => apiRef.current?.scrollTo(i)}
                                                            aria-label={img.label || `Go to image ${i + 1}`}
                                                            aria-current={activeIndex === i ? 'true' : undefined}
                                                            className={`relative shrink-0 w-20 h-14 rounded-sm border transition-shadow overflow-hidden ${focusRing} ${activeIndex === i ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-muted-foreground'}`}
                                                        >
                                                            <img
                                                                src={img.thumbnailUrl ?? img.url}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </button>
                                                    </ImageTooltip>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Mobile: collapsible metadata toggle */}
                                    {hasMeta && (
                                        <div className="sm:hidden border-t border-border">
                                            <button
                                                onClick={() => setMetaOpen(o => !o)}
                                                aria-expanded={metaOpen}
                                                className={`w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ${focusRing}`}
                                            >
                                                <span>Details</span>
                                                {metaOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
                                            </button>
                                            {metaOpen && (
                                                <div className="px-4 pb-3 space-y-1 max-h-36 overflow-y-auto">
                                                    {activeImage?.metadata?.map(({ label, value }) => (
                                                        <div key={label} className="flex gap-2 text-sm">
                                                            <span className="text-muted-foreground shrink-0">{label}</span>
                                                            <span className="text-foreground">{value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right: metadata panel — desktop only */}
                                {hasMeta && (
                                    <div className="hidden sm:flex flex-col w-56 border-l border-border shrink-0 overflow-y-auto">
                                        <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</p>
                                        <div className="px-4 pb-4 space-y-3">
                                            {activeImage?.metadata?.map(({ label, value }) => (
                                                <div key={label}>
                                                    <p className="text-xs text-muted-foreground">{label}</p>
                                                    <p className="text-sm text-foreground">{value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    )
}
