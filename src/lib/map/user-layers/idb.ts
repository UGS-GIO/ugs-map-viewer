/**
 * Minimal IndexedDB store for user-uploaded layers.
 *
 * Uploaded files (drag-drop GeoJSON) can't fit in the shareable `?userLayers=`
 * URL, so their full definition — including inline GeoJSON data — is persisted
 * here instead. It survives reload in the same browser but is intentionally NOT
 * shareable by link (that would need a warehouse upload endpoint). Remote
 * URL-based layers do NOT come through here; they live in the URL.
 */
import type { LayerProps } from '@/lib/types/mapping-types'

const DB_NAME = 'ugs-user-layers'
const STORE = 'layers'
const VERSION = 1

/** One persisted upload: the full runtime layer def (with inline `data`). */
export interface StoredUserLayer {
    /** Stable id (also the layer's `idbKey`). */
    id: string
    /** The complete LayerProps, including inline GeoJSON `data` for geojson uploads. */
    def: LayerProps
    /** Creation order, for stable listing. */
    createdAt: number
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, VERSION)
        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: 'id' })
            }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return openDb().then(db => new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
    }))
}

/** Persist (or overwrite) an uploaded layer. */
export function putUserLayer(record: StoredUserLayer): Promise<void> {
    return tx('readwrite', store => store.put(record) as IDBRequest<IDBValidKey>).then(() => undefined)
}

/** All persisted uploads, oldest first. Returns [] if IndexedDB is unavailable. */
export async function getAllUserLayers(): Promise<StoredUserLayer[]> {
    try {
        const all = await tx<StoredUserLayer[]>('readonly', store => store.getAll() as IDBRequest<StoredUserLayer[]>)
        return all.sort((a, b) => a.createdAt - b.createdAt)
    } catch (e) {
        console.warn('[user-layers] IndexedDB read failed:', e)
        return []
    }
}

/** Remove one persisted upload by id. */
export function deleteUserLayer(id: string): Promise<void> {
    return tx('readwrite', store => store.delete(id) as IDBRequest<undefined>).then(() => undefined)
}
