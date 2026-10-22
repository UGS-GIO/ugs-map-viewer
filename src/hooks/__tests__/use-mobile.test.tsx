// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PHONE_QUERY, useIsMobile } from '../use-mobile'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function firstRender(matches: boolean) {
  const queries: string[] = []
  vi.stubGlobal('matchMedia', (q: string) => {
    queries.push(q)
    return { matches, addEventListener: () => {}, removeEventListener: () => {} }
  })
  const seen: boolean[] = []
  function Probe() {
    seen.push(useIsMobile())
    return null
  }
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  act(() => root.render(<Probe />))
  act(() => root.unmount())
  return { first: seen[0], queries }
}

describe('useIsMobile', () => {
  it('is right on the first render', () => {
    expect(firstRender(true).first).toBe(true)
    expect(firstRender(false).first).toBe(false)
  })

  it('asks the phone query, which includes large phones in landscape', () => {
    expect(firstRender(true).queries).toContain(PHONE_QUERY)
    expect(PHONE_QUERY).toBe('(max-width: 767px), (pointer: coarse) and (max-height: 500px)')
  })
})
