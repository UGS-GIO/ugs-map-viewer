import { MapLoadingOverlay } from "@/components/custom/map/map-loading-overlay";

interface MapWrapperProps {
    mapRef: React.RefObject<HTMLDivElement>;
    isLoading: boolean;
    onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
    children: React.ReactNode;
}

export function MapWrapper({ mapRef, isLoading, onContextMenu, children }: MapWrapperProps) {
    return (
        <div
            className="absolute inset-0"
            ref={mapRef}
            onContextMenu={onContextMenu}
        >
            {children}
            <MapLoadingOverlay isLoading={isLoading} />
        </div>
    );
}
