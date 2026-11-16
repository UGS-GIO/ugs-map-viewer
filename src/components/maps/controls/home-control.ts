import * as maplibregl from 'maplibre-gl';

// Lucide's Home icon, inlined: rendering it with react-dom/server shipped ~75 KB of server renderer
const HOME_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

export interface HomeControlOptions {
  initialBounds?: maplibregl.LngLatBounds;
}

/**
 * Home control - resets map to initial bounds or default center/zoom
 * Implements the MapLibre GL JS IControl interface
 */
export class HomeControl implements maplibregl.IControl {
  private container?: HTMLElement;
  private initialBounds?: maplibregl.LngLatBounds;

  constructor(options: HomeControlOptions = {}) {
    this.initialBounds = options.initialBounds;
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const button = document.createElement('button');
    button.className = 'maplibregl-ctrl-icon';
    button.type = 'button';
    button.title = 'Go to home view';
    button.setAttribute('aria-label', 'Go to home view');

    button.innerHTML = HOME_ICON;

    // Home is flat and north-up; 3D terrain stays as the user set it
    button.addEventListener('click', () => {
      if (this.initialBounds) {
        map.fitBounds(this.initialBounds, { padding: 50, pitch: 0, bearing: 0 });
      } else {
        map.flyTo({ center: [-111.5, 39], zoom: 6, pitch: 0, bearing: 0 });
      }
    });

    this.container.appendChild(button);
    return this.container;
  }

  onRemove(): void {
    this.container?.parentNode?.removeChild(this.container);
  }
}
