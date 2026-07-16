/**
 * Runtime user-added layers ("add layer" feature).
 *
 * Two persistence lanes, by physics:
 *  - REMOTE layers (PMTiles/GeoJSON/WMS/COG/STAC by URL or id) are stored as
 *    compact *recipes* in the `?userLayers=` search param and rebuilt on load.
 *    Small → the link is shareable.
 *  - UPLOADED files (GeoJSON drag-drop) carry inline data too big for a URL, so
 *    they live in IndexedDB ({@link ./idb}). They survive reload in the same
 *    browser but are NOT shareable by link.
 *
 * This provider sits ABOVE {@link LayerUrlProvider} so user-layer titles are
 * valid when the URL provider validates selection. It therefore can't select
 * layers itself — the add-layer dialog (inside both providers) calls
 * `useLayerUrl().updateLayerSelection` after adding.
 */
import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { LayerProps } from '@/lib/types/mapping-types'
import { buildLayerFromUrl, objectUrlForCog, type DetectedFormat, type UploadedLayer } from '@/lib/map/user-layers/detect'
import { getAllUserLayers, putUserLayer, deleteUserLayer } from '@/lib/map/user-layers/idb'
import { registerLocalPMTiles } from '@/lib/map/pmtiles/setup'

/** Compact, shareable description of a remote user layer (rebuilt on load). */
export interface UserLayerRecipe {
    url: string
    title: string
    format?: DetectedFormat
    wmsLayerName?: string
}

interface UserLayersContextType {
    /** Merged, render-ready user layers (rebuilt remotes + hydrated uploads). */
    userLayers: LayerProps[]
    /** Titles of all user layers (built + still-building), valid immediately. */
    userLayerTitles: Set<string>
    /** Add a remote (URL/id) layer: writes a recipe to the URL; returns final title. */
    addRemoteLayer: (recipe: UserLayerRecipe) => string
    /** Add an uploaded layer (GeoJSON or PMTiles): persists it to IndexedDB. Returns final title. */
    addUploadedLayer: (def: UploadedLayer, file?: File) => Promise<string>
    /** Remove a user layer by title (from URL or IndexedDB). */
    removeUserLayer: (title: string) => void
    /** True while remote recipes are being (re)built. */
    isBuilding: boolean
    /**
     * True once uploaded layers have been read back from IndexedDB. Consumers
     * that validate layer titles (see `LayerUrlProvider`) MUST wait for this —
     * an upload's title lives in `?layers.selected` but its definition only
     * appears after the async hydration, so validating early would strip it.
     */
    isHydrated: boolean
}

const noop = () => ''
const defaultValue: UserLayersContextType = {
    userLayers: [],
    userLayerTitles: new Set(),
    addRemoteLayer: noop,
    addUploadedLayer: async () => '',
    removeUserLayer: () => {},
    isBuilding: false,
    // No provider → nothing to hydrate, so consumers must not stall.
    isHydrated: true,
}

// Non-undefined default so `useUserLayers()` is safe outside the provider
// (e.g. useGetLayerConfigs on non-map routes) — it just yields no user layers.
const UserLayersContext = createContext<UserLayersContextType>(defaultValue)

/** Make a title unique against an existing set by suffixing " (n)". */
function uniqueTitle(desired: string, taken: Set<string>): string {
    if (!taken.has(desired)) return desired
    let n = 2
    while (taken.has(`${desired} (${n})`)) n++
    return `${desired} (${n})`
}

export const UserLayersProvider = ({ children }: { children: ReactNode }) => {
    const navigate = useNavigate()
    const { userLayers: urlRecipes } = useSearch({ from: '/_map' }) as { userLayers?: UserLayerRecipe[] }

    const recipes = useMemo(() => urlRecipes ?? [], [urlRecipes])
    const recipesKey = useMemo(() => JSON.stringify(recipes), [recipes])

    const [remoteBuilt, setRemoteBuilt] = useState<LayerProps[]>([])
    const [uploads, setUploads] = useState<UploadedLayer[]>([])
    const [isBuilding, setIsBuilding] = useState(false)
    const [isHydrated, setIsHydrated] = useState(false)

    // Rebuild remote layers whenever the URL recipes change.
    useEffect(() => {
        let cancelled = false
        if (recipes.length === 0) { setRemoteBuilt([]); return }
        setIsBuilding(true)
        Promise.all(
            recipes.map(r =>
                buildLayerFromUrl(r.url, { title: r.title, format: r.format, wmsLayerName: r.wmsLayerName })
                    .catch(e => {
                        console.error(`[user-layers] failed to build "${r.title}" from ${r.url}:`, e)
                        toast.error(`Couldn't load layer "${r.title}"`, { description: e instanceof Error ? e.message : String(e) })
                        return null
                    }),
            ),
        ).then(built => {
            if (cancelled) return
            setRemoteBuilt(built.filter((l): l is LayerProps => l != null))
            setIsBuilding(false)
        })
        return () => { cancelled = true }
    }, [recipesKey]) // eslint-disable-line react-hooks/exhaustive-deps

    // Hydrate uploaded layers from IndexedDB once on mount. Always flips
    // `isHydrated`, even on failure, so a broken IndexedDB can't wedge the
    // consumers gated on it.
    useEffect(() => {
        getAllUserLayers()
            .then(records => {
                // Re-register File-backed PMTiles archives BEFORE the layers mount:
                // on a protocol cache miss the key would be fetched as a URL and 404.
                const restored: UploadedLayer[] = []
                for (const r of records) {
                    const def = r.def as UploadedLayer
                    // File-backed uploads need their browser-side handle rebuilt.
                    if (def.type === 'pmtiles' || def.type === 'cog') {
                        if (!r.file) {
                            console.warn(`[user-layers] dropping "${def.title}" — persisted file is missing`)
                            continue
                        }
                        try {
                            if (def.type === 'pmtiles') {
                                // Must precede mount: a protocol cache miss would fetch the key as a URL.
                                registerLocalPMTiles(r.file)
                                restored.push(def)
                            } else {
                                // Object URLs die with the previous document, so the persisted
                                // `cogUrl` is stale — always mint a fresh one.
                                restored.push({ ...def, cogUrl: objectUrlForCog(r.file) })
                            }
                        } catch (e) {
                            console.warn(`[user-layers] could not restore "${def.title}":`, e)
                        }
                        continue
                    }
                    restored.push(def)
                }
                setUploads(restored)
            })
            .catch(e => console.warn('[user-layers] hydrate failed:', e))
            .finally(() => setIsHydrated(true))
    }, [])

    const userLayers = useMemo(() => [...remoteBuilt, ...uploads], [remoteBuilt, uploads])

    // Titles known synchronously (recipes + uploads), so selection stays valid
    // even before async builds finish.
    const userLayerTitles = useMemo(() => {
        const s = new Set<string>()
        recipes.forEach(r => r.title && s.add(r.title))
        uploads.forEach(u => u.title && s.add(u.title))
        return s
    }, [recipes, uploads])

    const takenTitles = useCallback(() => {
        const s = new Set<string>()
        recipes.forEach(r => s.add(r.title))
        uploads.forEach(u => s.add(u.title))
        return s
    }, [recipes, uploads])

    const addRemoteLayer = useCallback((recipe: UserLayerRecipe): string => {
        const title = uniqueTitle(recipe.title, takenTitles())
        const finalRecipe = { ...recipe, title }
        navigate({
            to: '.',
            search: (prev) => ({
                ...prev,
                userLayers: [...((prev as { userLayers?: UserLayerRecipe[] }).userLayers ?? []), finalRecipe],
            }),
            replace: true,
        })
        return title
    }, [navigate, takenTitles])

    const addUploadedLayer = useCallback(async (def: UploadedLayer, file?: File): Promise<string> => {
        const title = uniqueTitle(def.title, takenTitles())
        const id = def.idbKey ?? title
        const finalDef = { ...def, title, idbKey: id }
        // PMTiles and COG are File-backed, so the file must be persisted to rebuild
        // their FileSource / object URL on reload. GeoJSON carries its data inline.
        const storedFile = finalDef.type === 'pmtiles' || finalDef.type === 'cog' ? file : undefined
        await putUserLayer({ id, def: finalDef, file: storedFile, createdAt: performance.now() })
        setUploads(prev => [...prev, finalDef])
        return title
    }, [takenTitles])

    const removeUserLayer = useCallback((title: string) => {
        // Remote? Drop its recipe from the URL.
        const isRemote = recipes.some(r => r.title === title)
        if (isRemote) {
            navigate({
                to: '.',
                search: (prev) => {
                    const next = ((prev as { userLayers?: UserLayerRecipe[] }).userLayers ?? []).filter(r => r.title !== title)
                    return { ...prev, userLayers: next.length ? next : undefined }
                },
                replace: true,
            })
            return
        }
        // Upload? Remove from IndexedDB + state.
        const upload = uploads.find(u => u.title === title)
        if (upload) {
            // Release the COG's object URL — it pins the file's bytes in memory.
            if (upload.type === 'cog' && upload.cogUrl?.startsWith('blob:')) {
                URL.revokeObjectURL(upload.cogUrl)
            }
            deleteUserLayer(upload.idbKey ?? title).catch(e => console.warn('[user-layers] IDB delete failed:', e))
            setUploads(prev => prev.filter(u => u.title !== title))
        }
    }, [navigate, recipes, uploads])

    const value = useMemo<UserLayersContextType>(() => ({
        userLayers,
        userLayerTitles,
        addRemoteLayer,
        addUploadedLayer,
        removeUserLayer,
        isBuilding,
        isHydrated,
    }), [userLayers, userLayerTitles, addRemoteLayer, addUploadedLayer, removeUserLayer, isBuilding, isHydrated])

    return <UserLayersContext.Provider value={value}>{children}</UserLayersContext.Provider>
}

export const useUserLayers = () => useContext(UserLayersContext)
