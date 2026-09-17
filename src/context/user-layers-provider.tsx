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
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { LayerProps, ParquetLayerProps } from '@/lib/types/mapping-types'
import { buildLayerFromUrl, objectUrlForCog, releaseUploadedLayer, type UploadedLayer, type DetectedFormat } from '@/lib/map/user-layers/detect'
import { loadParquetForDeck, dropParquetTables } from '@/lib/map/user-layers/parquet-deck-loader'
import { getAllUserLayers, putUserLayer, deleteUserLayer } from '@/lib/map/user-layers/idb'
import { registerLocalPMTiles } from '@/lib/map/pmtiles/setup'

/** Compact, shareable description of a remote user layer (rebuilt on load). */
export interface UserLayerRecipe {
    url: string
    title: string
    format?: DetectedFormat
    wmsLayerName?: string
}

/** React Query key for a remote recipe. Exported so the add-layer dialog can
 *  seed the cache with the layer it already built to validate the input,
 *  instead of making this provider fetch and parse the source a second time. */
export const userRemoteLayerKey = (r: UserLayerRecipe) =>
    ['user-remote-layer', r.url, r.title, r.format, r.wmsLayerName] as const

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
    const queryClient = useQueryClient()

    // Declaratively resolve remote layers from URL search params via React Query.
    // Zero useEffects, no stale state tearing or double-navigation race conditions.
    const remoteQueries = useQueries({
        queries: recipes.map(r => ({
            queryKey: userRemoteLayerKey(r),
            queryFn: async (): Promise<LayerProps | null> => {
                try {
                    return await buildLayerFromUrl(r.url, {
                        title: r.title,
                        format: r.format,
                        wmsLayerName: r.wmsLayerName,
                    })
                } catch (e) {
                    console.error(`[user-layers] failed to build "${r.title}" from ${r.url}:`, e)
                    toast.error(`Couldn't load layer "${r.title}"`, {
                        description: e instanceof Error ? e.message : String(e),
                    })
                    return null
                }
            },
            staleTime: Infinity,
        })),
    })

    // `useQueries` hands back a fresh outer array every render (the `data`
    // entries themselves are structurally shared and stable), so a `useMemo` on
    // it would recompute every time. Hold the last array and swap it only when
    // an entry actually changes — `userLayers` feeds the whole layer tree, and a
    // new identity each render rebuilds every layer config downstream.
    const remoteBuiltRef = useRef<LayerProps[]>([])
    const nextRemoteBuilt = remoteQueries.map(q => q.data).filter((l): l is LayerProps => l != null)
    if (
        nextRemoteBuilt.length !== remoteBuiltRef.current.length ||
        nextRemoteBuilt.some((l, i) => l !== remoteBuiltRef.current[i])
    ) {
        remoteBuiltRef.current = nextRemoteBuilt
    }
    const remoteBuilt = remoteBuiltRef.current

    const [uploads, setUploads] = useState<UploadedLayer[]>([])
    const [isHydrated, setIsHydrated] = useState(false)

    const uploadsRef = useRef<UploadedLayer[]>(uploads)
    uploadsRef.current = uploads

    // Cleanup active COG blob URLs on unmount so file bytes don't leak in memory.
    useEffect(() => {
        return () => {
            for (const u of uploadsRef.current) {
                if (u.type === 'cog') releaseUploadedLayer(u)
            }
        }
    }, [])

    // Hydrate uploaded layers from IndexedDB once on mount. Always flips
    // `isHydrated`, even on failure, so a broken IndexedDB can't wedge the
    // consumers gated on it.
    useEffect(() => {
        getAllUserLayers()
            .then(async (records) => {
                // Re-register File-backed PMTiles archives BEFORE the layers mount:
                // on a protocol cache miss the key would be fetched as a URL and 404.
                const restored: UploadedLayer[] = []
                for (const r of records) {
                    const def = r.def as UploadedLayer
                    // File-backed uploads need their browser-side handle rebuilt.
                    if (def.type === 'pmtiles' || def.type === 'cog' || def.type === 'parquet') {
                        if (!r.file) {
                            console.warn(`[user-layers] dropping "${def.title}" — persisted file is missing`)
                            continue
                        }
                        try {
                            if (def.type === 'pmtiles') {
                                // Must precede mount: a protocol cache miss would fetch the key as a URL.
                                registerLocalPMTiles(r.file)
                                restored.push(def)
                            } else if (def.type === 'cog') {
                                // Object URLs die with the previous document, so the persisted
                                // `cogUrl` is stale — always mint a fresh one.
                                restored.push({ ...def, cogUrl: objectUrlForCog(r.file) })
                            } else if (def.type === 'parquet') {
                                const deckData = await loadParquetForDeck(r.file)
                                restored.push({ ...def, deckData })
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
            search: (prev) => {
                const prevUserLayers = (prev as { userLayers?: UserLayerRecipe[] }).userLayers ?? []
                const currentSelected = new Set((prev as { layers?: { selected?: string[] } }).layers?.selected || [])
                currentSelected.add(title)
                return {
                    ...prev,
                    userLayers: [...prevUserLayers, finalRecipe],
                    layers: { selected: Array.from(currentSelected) },
                }
            },
            replace: true,
        })
        return title
    }, [navigate, takenTitles])

    const addUploadedLayer = useCallback(async (def: UploadedLayer, file?: File): Promise<string> => {
        const title = uniqueTitle(def.title, takenTitles())
        const id = def.idbKey ?? title
        const finalDef = { ...def, title, idbKey: id }
        // PMTiles, COG, and Parquet are File-backed. GeoJSON carries its data inline.
        const storedFile = finalDef.type === 'pmtiles' || finalDef.type === 'cog' || finalDef.type === 'parquet' ? file : undefined
        // Do not serialize heavy binary deckData into IndexedDB so writes are instantaneous
        const idbDef = finalDef.type === 'parquet' ? { ...finalDef, deckData: undefined } : finalDef
        await putUserLayer({ id, def: idbDef, file: storedFile, createdAt: performance.now() })
        setUploads(prev => [...prev, finalDef])
        navigate({
            to: '.',
            search: (prev) => {
                const currentSelected = new Set((prev as { layers?: { selected?: string[] } }).layers?.selected || [])
                currentSelected.add(title)
                return {
                    ...prev,
                    layers: { selected: Array.from(currentSelected) },
                }
            },
            replace: true,
        })
        return title
    }, [takenTitles, navigate])

    const removeUserLayer = useCallback((title: string) => {
        // Drop the recipe (if remote) and the selection in ONE navigate. Two
        // navigates in the same tick each spread a `prev` captured before the
        // other applied, so the second silently undoes the first.
        navigate({
            to: '.',
            search: (prev) => {
                const p = prev as { userLayers?: UserLayerRecipe[]; layers?: { selected?: string[] } }
                const nextRecipes = (p.userLayers ?? []).filter(r => r.title !== title)
                const nextSelected = (p.layers?.selected ?? []).filter(t => t !== title)
                return {
                    ...prev,
                    userLayers: nextRecipes.length ? nextRecipes : undefined,
                    layers: { ...p.layers, selected: nextSelected },
                }
            },
            replace: true,
        })

        // A Parquet layer's attributes sit in a DuckDB table that outlives the
        // React tree, so it has to be dropped explicitly (remote or uploaded).
        const removed = userLayers.find(l => l.title === title)
        if (removed?.type === 'parquet') {
            const deckData = (removed as ParquetLayerProps).deckData
            if (deckData) void dropParquetTables(deckData)
        }

        // The built layer is cached with `staleTime: Infinity`, so re-adding the
        // same URL under the same title would hand back a layer whose DuckDB
        // tables have just been dropped.
        const removedRecipe = recipes.find(r => r.title === title)
        if (removedRecipe) queryClient.removeQueries({ queryKey: userRemoteLayerKey(removedRecipe) })

        // Upload? Also remove from IndexedDB + state.
        const upload = uploads.find(u => u.title === title)
        if (upload) {
            // Release the COG's object URL — it pins the file's bytes in memory.
            releaseUploadedLayer(upload)
            deleteUserLayer(upload.idbKey ?? title).catch(e => console.warn('[user-layers] IDB delete failed:', e))
            setUploads(prev => prev.filter(u => u.title !== title))
        }
    }, [navigate, uploads, userLayers, recipes, queryClient])

    const value = useMemo<UserLayersContextType>(() => ({
        userLayers,
        userLayerTitles,
        addRemoteLayer,
        addUploadedLayer,
        removeUserLayer,
        isHydrated,
    }), [userLayers, userLayerTitles, addRemoteLayer, addUploadedLayer, removeUserLayer, isHydrated])

    return <UserLayersContext.Provider value={value}>{children}</UserLayersContext.Provider>
}

export const useUserLayers = () => useContext(UserLayersContext)
