// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SideLink } from '@/lib/types/sidelink-types'
import { MoreList } from './more-list'
import { act, render } from './test-utils'

const startTour = vi.fn()
vi.mock('@/lib/tour', () => ({
  useTour: () => ({ startTour }),
  TOUR_ROUTE_BY_PAGE: { hazards: 'hazards' },
}))
const peek = vi.fn()
vi.mock('./use-phone-sheet', () => ({ usePhoneSheetActions: () => ({ peek }) }))
vi.mock('@/hooks/use-dark-theme', () => ({ useDarkTheme: () => ({ isDark: false, setDark: () => {} }) }))

const Panel = () => <div />
const links: SideLink[] = [
  { title: 'Home', icon: <span /> },
  { title: 'Info', icon: <span />, component: Panel },
  { title: 'Layers', icon: <span />, component: Panel },
  { title: 'Map Configurations', icon: <span />, component: Panel },
  { title: 'Feedback', icon: <span />, href: 'https://forms.gle/example' },
]

afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('MoreList', () => {
  it('lists everything the tabs do not already cover', () => {
    const { container } = render(<MoreList links={links} page="hazards" onOpen={vi.fn()} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Map Configurations')
    expect(text).toContain('Feedback')
    expect(text).not.toMatch(/\bHome\b/)
    expect(text).not.toMatch(/\bInfo\b/)
    expect(text).not.toMatch(/\bLayers\b/)
  })

  it('opens a panel by its tab name', () => {
    const onOpen = vi.fn()
    const { container } = render(<MoreList links={links} page="hazards" onOpen={onOpen} />)
    const row = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Map Configurations'))!
    act(() => row.click())
    expect(onOpen).toHaveBeenCalledWith('map configurations')
  })

  it('opens an external link in a new tab', () => {
    const { container } = render(<MoreList links={links} page="hazards" onOpen={vi.fn()} />)
    const a = container.querySelector('a[href="https://forms.gle/example"]')!
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('drops the sheet to its peek and starts the tour', () => {
    const { container } = render(<MoreList links={links} page="hazards" onOpen={vi.fn()} />)
    const row = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Take the tour'))!
    act(() => row.click())
    expect(peek).toHaveBeenCalled()
    expect(startTour).toHaveBeenCalled()
  })
})
