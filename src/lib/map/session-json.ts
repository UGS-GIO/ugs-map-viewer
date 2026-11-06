/** sessionStorage, or undefined where the browser blocks it (reading the property itself can throw) */
export function sessionStorageIfAllowed(): Storage | undefined {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

/** JSON in storage, tolerating blocked, full or corrupt storage */
export function readJson<T>(storage: Storage | undefined, key: string, fallback: T): T {
  try {
    const raw = storage?.getItem(key)
    return (raw ? JSON.parse(raw) : null) ?? fallback
  } catch {
    return fallback
  }
}

export function writeJson(storage: Storage | undefined, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // Still works for this page, just not across a reload
  }
}
