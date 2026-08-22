import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { type DisplacementLayerTitle } from './displacement-layers'

// Ephemeral state for the wide "analysis view" pop-out. Kept OUT of the URL-driven
// filter context on purpose: this is transient dialog state, not a shareable filter.
//
// The whole point of a separate provider is placement — it wraps the hazards-review
// tree ABOVE the sidebar's surface-switch remount (`key={activeChild.title}` in
// use-custom-layerlist), so a single host-rendered dialog persists while the user
// flips Cumulative / Yearly / Rate inside it. `activeTitle` is the displacement
// layer whose stats the dialog is showing; the in-dialog surface switch just points
// it at a sibling title (see the host), independent of the sidebar/map selection.
interface DisplacementAnalysisState {
    /** True while the analysis pop-out is open. */
    open: boolean
    /** The displacement layer title the pop-out is showing, or null when closed. */
    activeTitle: DisplacementLayerTitle | null
    /** Open the pop-out on a given surface (called by each panel's "Expand"). */
    openAnalysis: (title: DisplacementLayerTitle) => void
    /** Point the open pop-out at another surface (the in-dialog switch). */
    setActiveTitle: (title: DisplacementLayerTitle) => void
    /** Close the pop-out. */
    closeAnalysis: () => void
}

const DisplacementAnalysisContext = createContext<DisplacementAnalysisState | null>(null)

export function DisplacementAnalysisProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false)
    const [activeTitle, setActiveTitleState] = useState<DisplacementLayerTitle | null>(null)

    const openAnalysis = useCallback((title: DisplacementLayerTitle) => {
        setActiveTitleState(title)
        setOpen(true)
    }, [])
    const setActiveTitle = useCallback((title: DisplacementLayerTitle) => setActiveTitleState(title), [])
    const closeAnalysis = useCallback(() => setOpen(false), [])

    const value = useMemo<DisplacementAnalysisState>(
        () => ({ open, activeTitle, openAnalysis, setActiveTitle, closeAnalysis }),
        [open, activeTitle, openAnalysis, setActiveTitle, closeAnalysis],
    )
    return (
        <DisplacementAnalysisContext.Provider value={value}>
            {children}
        </DisplacementAnalysisContext.Provider>
    )
}

export function useDisplacementAnalysis(): DisplacementAnalysisState {
    const ctx = useContext(DisplacementAnalysisContext)
    if (!ctx) throw new Error('useDisplacementAnalysis must be used within DisplacementAnalysisProvider')
    return ctx
}
