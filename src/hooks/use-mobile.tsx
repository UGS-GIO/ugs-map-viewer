import { useSyncExternalStore } from "react"

// Phones: narrow screens, plus large phones in landscape, which are wide but too short for the
// desktop sidebar. Mirrored by the phone rules in index.css.
export const PHONE_QUERY = "(max-width: 767px), (pointer: coarse) and (max-height: 500px)"

export const isPhoneViewport = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches

const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(PHONE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, isPhoneViewport, () => false)
}
