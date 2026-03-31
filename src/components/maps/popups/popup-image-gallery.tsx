import { useRef, useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from '@/components/ui/carousel'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { ChevronDown, ChevronUp, X } from 'lucide-react'

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

export function PopupImageGallery({ images }: PopupImageGalleryProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const [metaOpen, setMetaOpen] = useState(false)
    const apiRef = useRef<CarouselApi>(undefined)

    const handleApiChange = (newApi: CarouselApi) => {
        if (!newApi) return
        apiRef.current = newApi
        setActiveIndex(newApi.selectedScrollSnap())
        newApi.on('select', () => setActiveIndex(newApi.selectedScrollSnap()))
    }

    const openAt = (i: number) => { setLightboxIndex(i); setActiveIndex(i); setMetaOpen(false) }

    if (images.length === 0) return null

    const showOverflow = images.length > GRID_VISIBLE + 1
    const gridImages = showOverflow ? images.slice(0, GRID_VISIBLE) : images
    const overflowCount = images.length - GRID_VISIBLE

    const activeImage = lightboxIndex !== null ? images[activeIndex] : null
    const hasMeta = (activeImage?.metadata?.length ?? 0) > 0

    return (
        <>
            {/* Thumbnail grid — 2 rows × 3 cols */}
            <div className="grid grid-cols-3 gap-1">
                {gridImages.map((img, i) => (
                    <button
                        key={img.url}
                        onClick={() => openAt(i)}
                        className="relative aspect-[4/3] rounded-md border border-border hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background overflow-hidden"
                    >
                        <img
                            src={img.thumbnailUrl ?? img.url}
                            alt={img.label || `Image ${i + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    </button>
                ))}

                {/* Overflow cell */}
                {showOverflow && (
                    <button
                        onClick={() => openAt(GRID_VISIBLE)}
                        className="relative aspect-[4/3] rounded-md border border-border hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-shadow focus-visible:outline-none overflow-hidden"
                    >
                        <img
                            src={images[GRID_VISIBLE].thumbnailUrl ?? images[GRID_VISIBLE].url}
                            alt={`+${overflowCount} more`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">+{overflowCount}</span>
                        </div>
                    </button>
                )}
            </div>

            <Dialog open={lightboxIndex !== null} onOpenChange={(open) => { if (!open) { setLightboxIndex(null); setMetaOpen(false) } }}>
                <DialogContent
                    className="max-w-[95vw] sm:max-w-[90vw] max-h-[90svh] p-0 bg-background border-border overflow-hidden"
                    onKeyDown={(e: React.KeyboardEvent) => {
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
                        {/* Header bar — close button never overlaps the image */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                            <span className="text-sm text-muted-foreground">
                                {activeIndex + 1} / {images.length}
                                {images[activeIndex]?.label ? ` · ${images[activeIndex].label}` : ''}
                            </span>
                            <DialogClose className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        {/* Desktop: side-by-side. Mobile: stacked. */}
                        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

                            {/* Left/top: carousel + strips */}
                            <div className="flex flex-col flex-1 min-h-0 min-w-0">
                                <Carousel
                                    setApi={handleApiChange}
                                    opts={{ startIndex: lightboxIndex ?? 0, loop: images.length > 1 }}
                                    className="flex-1 min-h-0"
                                >
                                    <CarouselContent>
                                        {images.map((img, i) => (
                                            <CarouselItem key={img.url} className="flex items-center justify-center">
                                                <div className="flex flex-col items-center gap-2 p-4">
                                                    <img
                                                        src={img.url}
                                                        alt={img.label || `Image ${i + 1}`}
                                                        className="max-w-full max-h-[50svh] sm:max-h-[60svh] object-contain rounded"
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
                                </Carousel>

                                {/* Thumbnail strip — desktop only */}
                                <div className="hidden sm:flex justify-center border-t border-border p-3">
                                    <div className="flex gap-2 overflow-x-auto scrollbar-thin p-1">
                                        {images.map((img, i) => (
                                            <button
                                                key={img.url}
                                                onClick={() => apiRef.current?.scrollTo(i)}
                                                className={`relative shrink-0 w-14 h-10 rounded-sm border transition-shadow ${activeIndex === i ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-muted-foreground'}`}
                                            >
                                                <img
                                                    src={img.thumbnailUrl ?? img.url}
                                                    alt={img.label || `Image ${i + 1}`}
                                                    className="w-full h-full object-cover rounded-sm"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Mobile: collapsible metadata toggle */}
                                {hasMeta && (
                                    <div className="sm:hidden border-t border-border">
                                        <button
                                            onClick={() => setMetaOpen(o => !o)}
                                            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                        >
                                            <span>Details</span>
                                            {metaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
