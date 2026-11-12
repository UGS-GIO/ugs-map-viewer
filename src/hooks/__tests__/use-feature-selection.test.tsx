// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClickedFeature } from '@/components/maps/types'
import { useFeatureSelection } from '../use-feature-selection'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const fault = (id: number): ClickedFeature => ({
  id,
  layerTitle: 'Faults',
  properties: { ogc_fid: id },
  geometry: { type: 'LineString', coordinates: [[-111.8, 40.6], [-111.7, 40.7]] },
})
const FEATURES = [fault(1), fault(2), fault(3)]

const unmounts: (() => void)[] = []
afterEach(() => unmounts.splice(0).forEach((unmount) => unmount()))

function setup() {
  const onHighlightChange = vi.fn()
  let hook: ReturnType<typeof useFeatureSelection> | undefined
  function Probe() {
    hook = useFeatureSelection({
      viewMode: 'table',
      selectedFeatureRefs: [],
      setSelectedFeatureRefs: vi.fn(),
      setClickBufferBounds: vi.fn(),
      setFeatureBbox: vi.fn(),
      openResults: vi.fn(),
      onHighlightChange,
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  act(() => root.render(<Probe />))
  unmounts.push(() => act(() => root.unmount()))
  const current = () => {
    if (!hook) throw new Error('Probe never rendered')
    return hook
  }
  const highlighted = () => onHighlightChange.mock.lastCall?.[0].map((f: { id: number }) => f.id)
  return { current, highlighted }
}

describe('useFeatureSelection highlights', () => {
  it('highlights only the first result of a click', () => {
    const { current, highlighted } = setup()
    act(() => current().handleFeatureClick(FEATURES))
    expect(highlighted()).toEqual([1])
  })

  it('highlights every result of a box or drawn area', () => {
    const { current, highlighted } = setup()
    act(() => current().handleFeatureClick(FEATURES, { highlightAll: true }))
    expect(highlighted()).toEqual([1, 2, 3])
    expect(current().selectedFeatures).toHaveLength(3)
  })

  it('skips results without geometry', () => {
    const { current, highlighted } = setup()
    act(() => current().handleFeatureClick([{ id: 9, properties: {} }, ...FEATURES], { highlightAll: true }))
    expect(highlighted()).toEqual([1, 2, 3])
  })
})
