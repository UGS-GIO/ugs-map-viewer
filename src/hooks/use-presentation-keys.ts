import { useEffect, useRef } from 'react'
import { usePresentation } from '@/hooks/use-presentation'

const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ']
const PREVIOUS_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp']
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable=false])'
// Space on these is a click, not "next"
const PRESSABLE = 'button, a, [role=button]'

/** Arrow keys and Page Up/Down move between stops, Escape leaves to explore. */
export function usePresentationKeys() {
  const { index, go, exit } = usePresentation()
  // Latest values for the one key listener below
  const keys = useRef({ index, go, exit })
  useEffect(() => { keys.current = { index, go, exit } })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.target instanceof Element && (e.target.closest(EDITABLE) || (e.key === ' ' && e.target.closest(PRESSABLE)))) return
      const { index, go, exit } = keys.current
      const step = NEXT_KEYS.includes(e.key) ? 1 : PREVIOUS_KEYS.includes(e.key) ? -1 : 0
      if (!step && e.key !== 'Escape') return
      // Ahead of the map, whose arrow keys would pan instead
      e.preventDefault()
      e.stopPropagation()
      if (step) go(index + step)
      else exit()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])
}
