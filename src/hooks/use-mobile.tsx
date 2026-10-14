import * as React from "react"

// Phones: narrow screens, plus large phones in landscape, which are wide but too short for the
// desktop sidebar. Mirrored by the phone rules in index.css.
export const PHONE_QUERY = "(max-width: 767px), (pointer: coarse) and (max-height: 500px)"

export const isPhoneViewport = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches

// Read synchronously on the first render: phones and desktop mount the map in different layouts,
// so a wrong first guess would build the map twice.
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(isPhoneViewport)

  React.useEffect(() => {
    const mql = window.matchMedia(PHONE_QUERY)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
