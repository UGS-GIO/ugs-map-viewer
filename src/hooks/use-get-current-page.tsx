import { useMemo } from "react";
import { useLocation } from "@tanstack/react-router";

/**
 * Set of pages that live under `routes/_map/*` — derived at build time from
 * the same vite glob the layer-config loaders use, so a new map page is
 * recognized automatically with no manual list to keep in sync.
 */
const KNOWN_MAP_PAGES: ReadonlySet<string> = (() => {
    const paths = Object.keys(import.meta.glob('@/routes/_map/*/-index.tsx'));
    const segments = paths
        .map(p => p.match(/_map\/([^/]+)\/-index\.tsx$/)?.[1])
        .filter((s): s is string => !!s);
    return new Set(segments);
})();

/** Raw first URL segment. Use {@link useGetCurrentMapPage} when the caller specifically needs a `_map/*` page. */
const useGetCurrentPage = () => {
    const { pathname } = useLocation();
    return pathname.split('/')[1];
}

/**
 * Validated map-page accessor. Returns the first path segment only when it
 * corresponds to an actual `routes/_map/{page}` directory; otherwise null.
 *
 * Consumers that build per-page asset paths (layer configs, sidebar configs,
 * etc.) must use this — passing a non-map segment (e.g. `summary`) into a
 * vite `import()` constructed from the segment trips "Unknown variable
 * dynamic import" at runtime.
 */
const useGetCurrentMapPage = (): string | null => {
    const { pathname } = useLocation();
    const seg = pathname.split('/')[1];
    return useMemo(() => (seg && KNOWN_MAP_PAGES.has(seg) ? seg : null), [seg]);
}

export { useGetCurrentPage, useGetCurrentMapPage };