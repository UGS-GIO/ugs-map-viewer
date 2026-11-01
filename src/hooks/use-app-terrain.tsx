import { useNavigate, useSearch } from '@tanstack/react-router';
import { useGetCurrentPage } from '@/hooks/use-get-current-page';
import { useMapInstance } from '@/context/map-instance-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { applyTerrain, EXAGGERATION, resolveAppTerrain } from '@/lib/terrain';

const TILT_3D = 60;

/** 3D (terrain + hillshade) for the app being viewed: the URL's choice, else the app's default. */
export function useAppTerrain() {
    const defaultTerrain = resolveAppTerrain(useGetCurrentPage(), useIsMobile());
    const search = useSearch({ from: '/_map' });
    const navigate = useNavigate();
    const { map } = useMapInstance();

    // Matching the default drops a param, so links stay short and follow later default changes
    const setSearch = (patch: Partial<typeof search>) =>
        navigate({ to: '.', search: (prev) => ({ ...prev, ...patch }), replace: true });

    const setTerrain = (value: boolean) => {
        setSearch({ terrain: value === defaultTerrain ? undefined : value });
        // Tilt on the way in so the switch visibly does something; flatten on the way out
        map?.easeTo(value ? { pitch: TILT_3D } : { pitch: 0, bearing: 0 });
    };

    const setExaggeration = (value: number) => {
        setSearch({ exaggeration: value === EXAGGERATION.default ? undefined : value });
        // Set here, not from the URL: Terrain3D only re-reads it on sourcedata (basemap swaps, tiles)
        if (map) applyTerrain(map, value);
    };

    return {
        terrain: search.terrain ?? defaultTerrain,
        setTerrain,
        exaggeration: search.exaggeration ?? EXAGGERATION.default,
        setExaggeration,
    };
}
