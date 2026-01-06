import type { IControl } from 'maplibre-gl'

/**
 * Simple MapLibre control that creates a container for React portal rendering.
 * Use with react-map-gl's useControl hook to add React components as map controls.
 */
export class PortalControl implements IControl {
  private container: HTMLDivElement | null = null

  onAdd(): HTMLDivElement {
    this.container = document.createElement('div')
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    // Make horizontal layout
    this.container.style.display = 'flex'
    this.container.style.flexDirection = 'row'
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
