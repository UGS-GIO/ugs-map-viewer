/** Get the active map implementation from VITE_MAP_IMPL env variable */
export function getMapImplementation(): 'arcgis' | 'maplibre' {
    return (import.meta.env.VITE_MAP_IMPL || 'arcgis') as 'arcgis' | 'maplibre';
}
