import maplibregl from 'maplibre-gl';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MousePointerClick, Pentagon, X } from 'lucide-react';
import type { SelectionMode } from '@/context/multi-select-context';

export interface MultiSelectControlOptions {
  onToggle?: (enabled: boolean) => void;
  onCancel?: () => void;
  onModeChange?: (mode: SelectionMode) => void;
  initialMode?: SelectionMode;
}

/**
 * Selection Tool control - enables click-to-select or polygon drawing modes
 * Implements the MapLibre GL JS IControl interface
 */
export class MultiSelectControl implements maplibregl.IControl {
  private container?: HTMLElement;
  private mainButton?: HTMLButtonElement;
  private modeButton?: HTMLButtonElement;
  private cancelButton?: HTMLButtonElement;
  private instructionOverlay?: HTMLElement;
  private isEnabled: boolean = false;
  private mode: SelectionMode = 'click';
  private onToggle?: (enabled: boolean) => void;
  private onCancel?: () => void;
  private onModeChange?: (mode: SelectionMode) => void;

  constructor(options: MultiSelectControlOptions = {}) {
    this.onToggle = options.onToggle;
    this.onCancel = options.onCancel;
    this.onModeChange = options.onModeChange;
    this.mode = options.initialMode || 'click';
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.style.display = 'flex';
    this.container.style.gap = '0';

    // Main toggle button
    this.mainButton = document.createElement('button');
    this.mainButton.className = 'maplibregl-ctrl-icon';
    this.mainButton.type = 'button';
    this.updateMainButtonTitle();
    this.mainButton.setAttribute('aria-label', 'Toggle selection tool');
    this.mainButton.style.display = 'flex';
    this.mainButton.style.alignItems = 'center';
    this.mainButton.style.justifyContent = 'center';
    this.mainButton.style.color = '#333';
    this.updateMainButtonIcon();

    this.mainButton.addEventListener('click', () => {
      this.isEnabled = !this.isEnabled;
      this.updateButtonState();
      this.onToggle?.(this.isEnabled);
    });

    // Mode toggle button (click vs polygon) - only shown when enabled
    this.modeButton = document.createElement('button');
    this.modeButton.className = 'maplibregl-ctrl-icon';
    this.modeButton.type = 'button';
    this.modeButton.style.display = 'none';
    this.modeButton.style.alignItems = 'center';
    this.modeButton.style.justifyContent = 'center';
    this.modeButton.style.color = '#333';
    this.modeButton.style.borderLeft = '1px solid #ddd';
    this.updateModeButton();

    this.modeButton.addEventListener('click', () => {
      this.mode = this.mode === 'click' ? 'polygon' : 'click';
      this.updateModeButton();
      this.updateMainButtonIcon();
      this.updateMainButtonTitle();
      this.updateInstructionOverlay();
      this.onModeChange?.(this.mode);
    });

    // Cancel button (only shown when enabled)
    this.cancelButton = document.createElement('button');
    this.cancelButton.className = 'maplibregl-ctrl-icon';
    this.cancelButton.type = 'button';
    this.cancelButton.title = 'Cancel and clear selection';
    this.cancelButton.setAttribute('aria-label', 'Cancel selection');
    this.cancelButton.style.display = 'none';
    this.cancelButton.style.alignItems = 'center';
    this.cancelButton.style.justifyContent = 'center';
    this.cancelButton.style.color = '#d9534f';
    this.cancelButton.style.borderLeft = '1px solid #ddd';

    const xIcon = renderToStaticMarkup(
      createElement(X, { size: 18, strokeWidth: 2 })
    );
    this.cancelButton.innerHTML = xIcon;

    this.cancelButton.addEventListener('click', () => {
      this.isEnabled = false;
      this.updateButtonState();
      this.onCancel?.();
      this.onToggle?.(false);
    });

    // Create instruction overlay (floating above map)
    this.instructionOverlay = document.createElement('div');
    this.instructionOverlay.style.cssText = `
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-family: system-ui, sans-serif;
      pointer-events: none;
      z-index: 1000;
      display: none;
      white-space: nowrap;
    `;
    map.getContainer().appendChild(this.instructionOverlay);

    this.container.appendChild(this.mainButton);
    this.container.appendChild(this.modeButton);
    this.container.appendChild(this.cancelButton);

    return this.container;
  }

  onRemove(): void {
    this.instructionOverlay?.remove();
    this.container?.parentNode?.removeChild(this.container);
  }

  private updateMainButtonIcon(): void {
    if (!this.mainButton) return;
    const icon = this.mode === 'click'
      ? createElement(MousePointerClick, { size: 20, strokeWidth: 2 })
      : createElement(Pentagon, { size: 20, strokeWidth: 2 });
    this.mainButton.innerHTML = renderToStaticMarkup(icon);
  }

  private updateMainButtonTitle(): void {
    if (!this.mainButton) return;
    if (this.isEnabled) {
      this.mainButton.title = this.mode === 'click'
        ? 'Click mode active. Click to disable.'
        : 'Polygon mode active. Click to disable.';
    } else {
      this.mainButton.title = this.mode === 'click'
        ? 'Selection Tool: Click features to query'
        : 'Selection Tool: Draw polygon to query area';
    }
  }

  private updateModeButton(): void {
    if (!this.modeButton) return;
    const icon = this.mode === 'click'
      ? createElement(Pentagon, { size: 16, strokeWidth: 2 })
      : createElement(MousePointerClick, { size: 16, strokeWidth: 2 });
    this.modeButton.innerHTML = renderToStaticMarkup(icon);
    this.modeButton.title = this.mode === 'click'
      ? 'Switch to polygon mode'
      : 'Switch to click mode';
  }

  private updateInstructionOverlay(): void {
    if (!this.instructionOverlay) return;
    if (this.isEnabled) {
      this.instructionOverlay.textContent = this.mode === 'click'
        ? 'Click to select. Shift+click to add more.'
        : 'Click to draw polygon. Double-click to complete.';
      this.instructionOverlay.style.display = 'block';
    } else {
      this.instructionOverlay.style.display = 'none';
    }
  }

  private updateButtonState(): void {
    if (!this.mainButton || !this.cancelButton || !this.modeButton) return;

    if (this.isEnabled) {
      this.mainButton.style.backgroundColor = '#0078A8';
      this.mainButton.style.color = '#fff';
      this.modeButton.style.display = 'flex';
      this.cancelButton.style.display = 'flex';
    } else {
      this.mainButton.style.backgroundColor = '';
      this.mainButton.style.color = '#333';
      this.modeButton.style.display = 'none';
      this.cancelButton.style.display = 'none';
    }
    this.updateMainButtonTitle();
    this.updateInstructionOverlay();
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

  public setMode(mode: SelectionMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.updateModeButton();
      this.updateMainButtonIcon();
      this.updateMainButtonTitle();
      this.updateInstructionOverlay();
    }
  }

  public getMode(): SelectionMode {
    return this.mode;
  }
}
