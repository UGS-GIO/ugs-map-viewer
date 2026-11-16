import type { IControl } from 'maplibre-gl'

/**
 * Simple MapLibre control that creates a container for React portal rendering.
 * Use with react-map-gl's useControl hook to add React components as map controls.
 */
export class PortalControl implements IControl {
  // Made up front, so a portal can render into it before MapLibre adds the control
  private readonly container = document.createElement('div')

  constructor(className = 'maplibregl-ctrl maplibregl-ctrl-group') {
    this.container.className = className
  }

  onAdd(): HTMLDivElement {
    return this.container
  }

  onRemove(): void {
    this.container.remove()
  }

  getContainer(): HTMLDivElement {
    return this.container
  }
}
