import { useNavigate, useSearch } from '@tanstack/react-router';
import { useGetCurrentPage } from '@/hooks/use-get-current-page';
import { useMapInstance } from '@/context/map-instance-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { resolveAppTerrain } from '@/lib/terrain';

const TILT_3D = 60;

/** 3D (terrain + hillshade) for the app being viewed: the URL's choice, else the app's default. */
export function useAppTerrain() {
    const defaultTerrain = resolveAppTerrain(useGetCurrentPage(), useIsMobile());
    const search = useSearch({ from: '/_map' });
    const navigate = useNavigate();
    const { map } = useMapInstance();

    const setTerrain = (value: boolean) => {
        navigate({
            to: '.',
            // Matching the default drops the param, so links stay short and follow later default changes
            search: (prev) => ({ ...prev, terrain: value === defaultTerrain ? undefined : value }),
            replace: true,
        });
        // Tilt on the way in so the switch visibly does something; flatten on the way out
        map?.easeTo(value ? { pitch: TILT_3D } : { pitch: 0, bearing: 0 });
    };

    return { terrain: search.terrain ?? defaultTerrain, setTerrain };
}
