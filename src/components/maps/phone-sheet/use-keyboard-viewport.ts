import { useEffect, useState } from 'react'

// Less than this covered by the visual viewport is browser chrome, not a keyboard.
const KEYBOARD_MIN_PX = 100

// The visible area above the iOS keyboard, or null when no keyboard is up. iOS keeps the layout
// viewport fixed and shrinks only the visual viewport; a pinch zoom shrinks it too, so only an
// unzoomed page counts. Ported from ugs-fleet-fuel-finder's drawer.
export function useKeyboardViewport(): { top: number; height: number } | null {
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => {
      const covered = window.innerHeight - (vv.offsetTop + vv.height)
      const up = covered > KEYBOARD_MIN_PX && vv.scale <= 1.01
      setViewport((prev) => {
        if (!up) return null
        return prev && prev.top === vv.offsetTop && prev.height === vv.height ? prev : { top: vv.offsetTop, height: vv.height }
      })
    }
    // Panning fires scroll every frame; coalesce to one update per frame.
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(sync)
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', onScroll)
    }
  }, [])
  return viewport
}
