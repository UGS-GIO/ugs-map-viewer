import { MapContext } from "@/context/map-context";
import { useContext } from "react";

/** Access the map context (ArcGIS or MapLibre) */
export function useMap() {
    const context = useContext(MapContext);
    if (context === undefined) {
        throw new Error("useMap must be used within a MapProvider");
    }
    return context;
}