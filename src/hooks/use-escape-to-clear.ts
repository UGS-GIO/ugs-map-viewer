import { useEffect } from 'react'

// An open dialog, menu, popover, listbox or tour step owns Escape, even while it is closing.
const LAYER = '[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [data-radix-popper-content-wrapper], .driver-popover'
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable=false])'

/** True when an Escape keydown is free to clear the map selection. */
export function escapeClears(e: KeyboardEvent): boolean {
  if (e.key !== 'Escape' || e.defaultPrevented || e.repeat) return false
  if (e.target instanceof Element && e.target.closest(EDITABLE)) return false
  return document.querySelector(LAYER) === null
}

/** Runs `onClear` on an unclaimed Escape while `enabled`; callers pass false while a map tool owns Escape. */
export function useEscapeToClear(enabled: boolean, onClear: () => void) {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (escapeClears(e)) onClear()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, onClear])
}
