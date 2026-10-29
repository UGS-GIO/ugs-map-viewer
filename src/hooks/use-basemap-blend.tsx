import { useNavigate, useSearch } from '@tanstack/react-router';

/** Basemap blending (`blend` layers drawn under the hillshade and basemap labels), off unless the URL turns it on. */
export function useBasemapBlend() {
    const search = useSearch({ from: '/_map' });
    const navigate = useNavigate();

    const setBlend = (value: boolean) => {
        navigate({
            to: '.',
            search: (prev) => ({ ...prev, blend: value || undefined }),
            replace: true,
        });
    };

    return { blend: search.blend ?? false, setBlend };
}
