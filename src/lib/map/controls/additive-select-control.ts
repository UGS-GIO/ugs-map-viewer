import maplibregl from 'maplibre-gl';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Copy } from 'lucide-react';

export interface AdditiveSelectControlOptions {
  onToggle?: (enabled: boolean) => void;
}

/**
 * Simple toggle control for additive selection mode (like holding Shift)
 * When enabled, all map clicks act as additive (shift+click behavior)
 */
export class AdditiveSelectControl implements maplibregl.IControl {
  private container?: HTMLElement;
  private button?: HTMLButtonElement;
  private isEnabled: boolean = false;
  private onToggle?: (enabled: boolean) => void;

  constructor(options: AdditiveSelectControlOptions = {}) {
    this.onToggle = options.onToggle;
  }

  onAdd(_map: maplibregl.Map): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    this.button = document.createElement('button');
    this.button.className = 'maplibregl-ctrl-icon';
    this.button.type = 'button';
    this.button.title = 'Toggle additive selection (like holding Shift)';
    this.button.setAttribute('aria-label', 'Toggle additive selection');
    this.button.style.display = 'flex';
    this.button.style.alignItems = 'center';
    this.button.style.justifyContent = 'center';
    this.updateButtonState();

    this.button.addEventListener('click', () => {
      this.isEnabled = !this.isEnabled;
      this.updateButtonState();
      this.onToggle?.(this.isEnabled);
    });

    this.container.appendChild(this.button);
    return this.container;
  }

  onRemove(): void {
    this.container?.parentNode?.removeChild(this.container);
  }

  private updateButtonState(): void {
    if (!this.button) return;

    const icon = createElement(Copy, { size: 18, strokeWidth: 2 });
    this.button.innerHTML = renderToStaticMarkup(icon);

    if (this.isEnabled) {
      this.button.style.backgroundColor = '#0078A8';
      this.button.style.color = '#fff';
      this.button.title = 'Additive selection ON (click to disable)';
    } else {
      this.button.style.backgroundColor = '';
      this.button.style.color = '#333';
      this.button.title = 'Toggle additive selection (like holding Shift)';
    }
  }

  public setEnabled(enabled: boolean): void {
    if (this.isEnabled !== enabled) {
      this.isEnabled = enabled;
      this.updateButtonState();
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }
}
