import { createContext, useContext, useState, useCallback, useMemo } from 'react'

interface ScreenshotLoadingContextValue {
    registerLoading: (id: string) => void
    unregisterLoading: (id: string) => void
    isAllLoaded: boolean
}

const ScreenshotLoadingContext = createContext<ScreenshotLoadingContextValue | null>(null)

export function ScreenshotLoadingProvider({ children }: { children: React.ReactNode }) {
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

    const registerLoading = useCallback((id: string) => {
        setLoadingIds(prev => new Set(prev).add(id))
    }, [])

    const unregisterLoading = useCallback((id: string) => {
        setLoadingIds(prev => {
            const next = new Set(prev)
            next.delete(id)
            return next
        })
    }, [])

    const isAllLoaded = loadingIds.size === 0

    const value = useMemo(() => ({
        registerLoading,
        unregisterLoading,
        isAllLoaded
    }), [registerLoading, unregisterLoading, isAllLoaded])

    return (
        <ScreenshotLoadingContext.Provider value={value}>
            {children}
        </ScreenshotLoadingContext.Provider>
    )
}

export function useScreenshotLoading() {
    const context = useContext(ScreenshotLoadingContext)
    // Return no-op functions for standalone usage outside provider
    if (!context) {
        return {
            registerLoading: () => {},
            unregisterLoading: () => {},
            isAllLoaded: true
        }
    }
    return context
}

export function useIsAllScreenshotsLoaded() {
    const context = useContext(ScreenshotLoadingContext)
    // If no provider, assume loaded (for standalone usage)
    return context?.isAllLoaded ?? true
}
