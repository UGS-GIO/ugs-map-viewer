import { useRef, useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from '@/components/ui/carousel'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { X } from 'lucide-react'

export interface GalleryImage {
    url: string
    thumbnailUrl?: string
    label?: string
}

interface PopupImageGalleryProps {
    images: GalleryImage[]
}

export function PopupImageGallery({ images }: PopupImageGalleryProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const apiRef = useRef<CarouselApi>(undefined)

    const handleApiChange = (newApi: CarouselApi) => {
        if (!newApi) return
        apiRef.current = newApi
        setActiveIndex(newApi.selectedScrollSnap())
        newApi.on('select', () => setActiveIndex(newApi.selectedScrollSnap()))
    }

    if (images.length === 0) return null

    return (
        <>
            <div className="flex gap-2 overflow-x-auto p-1 scrollbar-thin">
                {images.map((img, i) => (
                    <button
                        key={img.url}
                        onClick={() => setLightboxIndex(i)}
                        className="relative shrink-0 w-20 h-16 rounded-md border border-border hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <img
                            src={img.thumbnailUrl ?? img.url}
                            alt={img.label || `Image ${i + 1}`}
                            className="w-full h-full object-cover rounded-sm"
                            loading="lazy"
                        />
                    </button>
                ))}
            </div>

            <Dialog open={lightboxIndex !== null} onOpenChange={(open: boolean) => { if (!open) setLightboxIndex(null) }}>
                <DialogContent
                    className="max-w-[90vw] max-h-[90svh] p-0 bg-background border-border overflow-hidden"
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

                    <div className="flex flex-col max-h-[90svh]">
                        <DialogClose className="absolute top-2 right-2 z-10 inline-flex items-center justify-center rounded-md p-3 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </DialogClose>

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
                                                className="max-w-full max-h-[60svh] object-contain rounded"
                                            />
                                            {img.label && (
                                                <p className="text-sm text-muted-foreground text-center">{img.label}</p>
                                            )}
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
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
