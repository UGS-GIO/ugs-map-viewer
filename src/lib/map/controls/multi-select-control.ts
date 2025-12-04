import maplibregl from 'maplibre-gl';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Box, X } from 'lucide-react';

export interface MultiSelectControlOptions {
  onToggle?: (enabled: boolean) => void;
  onCancel?: () => void;
}

/**
 * Multi-select control - enables/disables polygon drawing mode for multi-select queries
 * Implements the MapLibre GL JS IControl interface
 */
export class MultiSelectControl implements maplibregl.IControl {
  private container?: HTMLElement;
  private button?: HTMLButtonElement;
  private cancelButton?: HTMLButtonElement;
  private isEnabled: boolean = false;
  private onToggle?: (enabled: boolean) => void;
  private onCancel?: () => void;

  constructor(options: MultiSelectControlOptions = {}) {
    this.onToggle = options.onToggle;
    this.onCancel = options.onCancel;
  }

  onAdd(_map: maplibregl.Map): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.style.display = 'flex';
    this.container.style.gap = '4px';

    // Main toggle button
    this.button = document.createElement('button');
    this.button.className = 'maplibregl-ctrl-icon';
    this.button.type = 'button';
    this.button.title = 'Enable multi-select mode';
    this.button.setAttribute('aria-label', 'Toggle multi-select mode');

    // Box icon for multi-select
    const boxIcon = renderToStaticMarkup(
      createElement(Box, { size: 20, strokeWidth: 2 })
    );
    this.button.innerHTML = boxIcon;
    this.button.style.display = 'flex';
    this.button.style.alignItems = 'center';
    this.button.style.justifyContent = 'center';
    this.button.style.color = '#333';

    this.button.addEventListener('click', () => {
      this.isEnabled = !this.isEnabled;
      this.updateButtonState();
      this.onToggle?.(this.isEnabled);
    });

    // Cancel button (only shown when enabled)
    this.cancelButton = document.createElement('button');
    this.cancelButton.className = 'maplibregl-ctrl-icon';
    this.cancelButton.type = 'button';
    this.cancelButton.title = 'Cancel multi-select';
    this.cancelButton.setAttribute('aria-label', 'Cancel multi-select mode');
    this.cancelButton.style.display = 'none';

    const xIcon = renderToStaticMarkup(
      createElement(X, { size: 20, strokeWidth: 2 })
    );
    this.cancelButton.innerHTML = xIcon;
    this.cancelButton.style.display = 'none';
    this.cancelButton.style.alignItems = 'center';
    this.cancelButton.style.justifyContent = 'center';
    this.cancelButton.style.color = '#d9534f'; // Red for cancel

    this.cancelButton.addEventListener('click', () => {
      this.isEnabled = false;
      this.updateButtonState();
      this.onCancel?.();
      this.onToggle?.(false);
    });

    this.container.appendChild(this.button);
    this.container.appendChild(this.cancelButton);

    return this.container;
  }

  onRemove(): void {
    this.container?.parentNode?.removeChild(this.container);
  }

  /**
   * Update button visual state based on enabled/disabled
   */
  private updateButtonState(): void {
    if (!this.button || !this.cancelButton) return;

    if (this.isEnabled) {
      // Enabled state - button is "pressed"
      this.button.style.backgroundColor = '#0078A8';
      this.button.style.color = '#fff';
      this.button.title = 'Disable multi-select mode';
      this.cancelButton.style.display = 'flex';
    } else {
      // Disabled state - button is normal
      this.button.style.backgroundColor = '';
      this.button.style.color = '#333';
      this.button.title = 'Enable multi-select mode';
      this.cancelButton.style.display = 'none';
    }
  }

  /**
   * Programmatically set the enabled state (for external control)
   */
  public setEnabled(enabled: boolean): void {
    if (this.isEnabled !== enabled) {
      this.isEnabled = enabled;
      this.updateButtonState();
    }
  }

  /**
   * Get current enabled state
   */
  public getEnabled(): boolean {
    return this.isEnabled;
  }
}
