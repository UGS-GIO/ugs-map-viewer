import maplibregl from 'maplibre-gl';

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

    // SVG home icon
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2L2 9v7h4v-4h8v4h4V9L10 2z" fill="black"/>
      </svg>
    `;
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';

    button.addEventListener('click', () => {
      if (this.initialBounds) {
        map.fitBounds(this.initialBounds, { padding: 50 });
      } else {
        map.flyTo({ center: [-111.5, 39], zoom: 6 });
      }
    });

    this.container.appendChild(button);
    return this.container;
  }

  onRemove(): void {
    this.container?.parentNode?.removeChild(this.container);
  }
}
