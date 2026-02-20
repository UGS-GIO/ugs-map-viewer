import type { IControl } from 'maplibre-gl'

/**
 * Simple MapLibre control that creates a container for React portal rendering.
 * Use with react-map-gl's useControl hook to add React components as map controls.
 */
export class PortalControl implements IControl {
  private container: HTMLDivElement | null = null
  private className: string

  constructor(className = 'maplibregl-ctrl maplibregl-ctrl-group') {
    this.className = className
  }

  onAdd(): HTMLDivElement {
    this.container = document.createElement('div')
    this.container.className = this.className
    return this.container
  }

  onRemove(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    this.container = null
  }

  getContainer(): HTMLDivElement | null {
    return this.container
  }
}
