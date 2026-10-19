// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTourSteps } from '../tour-steps'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const phone = (matches: boolean) =>
  vi.stubGlobal('matchMedia', () => ({ matches, addEventListener: () => {}, removeEventListener: () => {} }))
const mount = (...ids: string[]) => {
  for (const id of ids) {
    const el = document.createElement('div')
    el.dataset.tour = id
    document.body.append(el)
  }
}
const titles = () => getTourSteps('hazards').map((s) => s.popover?.title)

describe('getTourSteps', () => {
  it('uses the phone steps on phones and skips route steps that point at sidebar panels', () => {
    phone(true)
    mount('phone-tabs', 'phone-sheet-header', 'phone-map', 'phone-tab-layers', 'phone-tab-more', 'report-generator')
    expect(titles()).toEqual(['Welcome to the Map Viewer', 'Tabs', 'The panel', 'Tap the map', 'Layers', 'More', 'Tour Complete!'])
  })

  it('keeps the desktop steps elsewhere', () => {
    phone(false)
    mount('sidebar-icons', 'phone-tabs')
    const t = titles()
    expect(t).toContain('Sidebar Navigation')
    expect(t).not.toContain('Tabs')
  })
})
