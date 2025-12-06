import { LoaderCircle } from 'lucide-react';

interface MapLoadingOverlayProps {
    isLoading: boolean;
}

export function MapLoadingOverlay({ isLoading }: MapLoadingOverlayProps) {
    if (!isLoading) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <LoaderCircle className="h-16 w-16 text-primary animate-spin drop-shadow-lg" />
        </div>
    );
}
