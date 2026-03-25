import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

export interface GalleryImage {
    url: string
    label?: string
}

interface PopupImageGalleryProps {
    images: GalleryImage[]
}

export function PopupImageGallery({ images }: PopupImageGalleryProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

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
                            src={img.url}
                            alt={img.label || `Image ${i + 1}`}
                            className="w-full h-full object-cover rounded-sm"
                            loading="lazy"
                        />
                    </button>
                ))}
            </div>

            <Dialog open={lightboxIndex !== null} onOpenChange={(open) => { if (!open) setLightboxIndex(null) }}>
                <DialogContent className="max-w-[90vw] max-h-[90svh] p-0 bg-background border-border overflow-hidden">
                    <VisuallyHidden>
                        <DialogTitle>
                            {lightboxIndex !== null ? (images[lightboxIndex].label || `Image ${lightboxIndex + 1}`) : 'Image'}
                        </DialogTitle>
                        <DialogDescription>Image gallery viewer</DialogDescription>
                    </VisuallyHidden>
                    <Carousel
                        opts={{ startIndex: lightboxIndex ?? 0, loop: images.length > 1 }}
                        className="w-full h-full"
                    >
                        <CarouselContent>
                            {images.map((img, i) => (
                                <CarouselItem key={img.url} className="flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-2 p-4 max-h-[85svh]">
                                        <img
                                            src={img.url}
                                            alt={img.label || `Image ${i + 1}`}
                                            className="max-w-full max-h-[75svh] object-contain rounded"
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
                                <CarouselPrevious className="left-2 bg-accent hover:bg-accent/80 border-border text-accent-foreground" />
                                <CarouselNext className="right-2 bg-accent hover:bg-accent/80 border-border text-accent-foreground" />
                            </>
                        )}
                    </Carousel>
                </DialogContent>
            </Dialog>
        </>
    )
}
