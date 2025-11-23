import { LoadingSpinner } from "@/components/custom/loading-spinner";
import { useMapLoading } from "@/hooks/use-map-loading";
import { useMap } from "@/hooks/use-map";

const MapLoadingSpinner = () => {
    const { map } = useMap();
    const isMapLoading = useMapLoading({
        map,
    });

    return (
        <>
            {isMapLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-gray-50 bg-opacity-75">
                    <LoadingSpinner />
                </div>
            )}
        </>
    )
}
export default MapLoadingSpinner;