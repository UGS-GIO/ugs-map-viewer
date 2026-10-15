import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

// React only flushes effects synchronously inside act() when this flag is set.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export function render(ui: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => root.render(ui))
  return {
    container,
    rerender: (next: ReactNode) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

export { act }
