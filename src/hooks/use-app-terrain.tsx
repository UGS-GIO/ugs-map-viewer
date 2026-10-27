import { useNavigate, useSearch } from '@tanstack/react-router';
import { useGetCurrentPage } from '@/hooks/use-get-current-page';
import { resolveAppTerrain, type AppTerrainConfig } from '@/lib/terrain';

/** Terrain and hillshade for the app being viewed: the URL's choice, else the app's default. */
export function useAppTerrain() {
    const defaults = resolveAppTerrain(useGetCurrentPage());
    const search = useSearch({ from: '/_map' });
    const navigate = useNavigate();

    const settings: AppTerrainConfig = {
        terrain: search.terrain ?? defaults.terrain,
        hillshade: search.hillshade ?? defaults.hillshade,
    };

    const setSetting = (key: keyof AppTerrainConfig, value: boolean) => {
        navigate({
            to: '.',
            // Matching the default drops the param, so links stay short and follow later default changes
            search: (prev) => ({ ...prev, [key]: value === defaults[key] ? undefined : value }),
            replace: true,
        });
    };

    return { ...settings, setSetting };
}
