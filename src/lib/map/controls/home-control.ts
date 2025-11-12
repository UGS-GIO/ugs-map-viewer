import maplibregl from 'maplibre-gl';
import { renderToStaticMarkup } from 'react-dom/server';
import { Home } from 'lucide-react';

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

    // Lucide Home icon (rendered from React component)
    // Use currentColor so it inherits from MapLibre's control styling
    const homeIcon = renderToStaticMarkup(
      Home({ size: 20, strokeWidth: 2 })
    );
    button.innerHTML = homeIcon;
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.color = '#333'; // MapLibre's default icon color

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
