import maplibregl from 'maplibre-gl';

export type DrawMode = 'off' | 'rectangle' | 'polygon';

export interface DrawSelectControlOptions {
  onModeChange?: (mode: DrawMode) => void;
  onClear?: () => void;
}

/**
 * Draw selection control with dropdown for rectangle/polygon modes
 * Matches the reference app's DrawFilterControl pattern
 */
export class DrawSelectControl implements maplibregl.IControl {
  private container?: HTMLElement;
  private button?: HTMLButtonElement;
  private menu?: HTMLDivElement;
  private mode: DrawMode = 'off';
  private hasResults: boolean = false;
  private showMenu: boolean = false;
  private onModeChange?: (mode: DrawMode) => void;
  private onClear?: () => void;
  private clickOutsideHandler?: (e: MouseEvent) => void;

  constructor(options: DrawSelectControlOptions = {}) {
    this.onModeChange = options.onModeChange;
    this.onClear = options.onClear;
  }

  onAdd(_map: maplibregl.Map): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.style.position = 'relative';

    // Main button
    this.button = document.createElement('button');
    this.button.className = 'maplibregl-ctrl-icon';
    this.button.type = 'button';
    this.button.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      width: auto;
      height: auto;
      min-width: 90px;
    `;
    this.updateButton();

    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });

    // Dropdown menu
    this.menu = document.createElement('div');
    this.menu.style.cssText = `
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid #e5e7eb;
      padding: 4px 0;
      z-index: 50;
      min-width: 160px;
      display: none;
    `;
    this.buildMenu();

    this.container.appendChild(this.button);
    this.container.appendChild(this.menu);

    return this.container;
  }

  onRemove(): void {
    if (this.clickOutsideHandler) {
      document.removeEventListener('mousedown', this.clickOutsideHandler);
    }
    this.container?.parentNode?.removeChild(this.container);
  }

  private toggleMenu(): void {
    this.showMenu = !this.showMenu;
    if (this.menu) {
      this.menu.style.display = this.showMenu ? 'block' : 'none';
    }
    if (this.showMenu) {
      this.clickOutsideHandler = (e: MouseEvent) => {
        if (this.container && !this.container.contains(e.target as Node)) {
          this.showMenu = false;
          if (this.menu) this.menu.style.display = 'none';
        }
      };
      document.addEventListener('mousedown', this.clickOutsideHandler);
    } else if (this.clickOutsideHandler) {
      document.removeEventListener('mousedown', this.clickOutsideHandler);
    }
  }

  private closeMenu(): void {
    this.showMenu = false;
    if (this.menu) this.menu.style.display = 'none';
    if (this.clickOutsideHandler) {
      document.removeEventListener('mousedown', this.clickOutsideHandler);
    }
  }

  private updateButton(): void {
    if (!this.button) return;

    const isDrawing = this.mode !== 'off';

    // Icon
    const iconSvg = this.mode === 'polygon'
      ? '<polygon points="12,2 22,8.5 18,21 6,21 2,8.5" stroke-width="2" fill="none"/>'
      : '<rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2" fill="none"/>';

    // Label
    const label = isDrawing
      ? (this.mode === 'rectangle' ? 'Drawing Box' : 'Drawing Polygon')
      : this.hasResults ? 'Has Selection' : 'Draw Select';

    // Colors
    if (isDrawing) {
      this.button.style.backgroundColor = '#0078A8';
      this.button.style.color = '#fff';
    } else if (this.hasResults) {
      this.button.style.backgroundColor = '#f59e0b';
      this.button.style.color = '#fff';
    } else {
      this.button.style.backgroundColor = '';
      this.button.style.color = '#333';
    }

    this.button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        ${iconSvg}
      </svg>
      <span style="font-size: 13px; font-weight: 500;">${label}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    `;

    this.button.title = isDrawing ? 'Click to change draw mode' : 'Draw to select features';
  }

  private buildMenu(): void {
    if (!this.menu) return;

    this.menu.innerHTML = '';
    const isDrawing = this.mode !== 'off';

    // Rectangle option
    const rectBtn = this.createMenuItem(
      '<rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2" fill="none"/>',
      'Draw Rectangle',
      this.mode === 'rectangle',
      () => this.selectMode('rectangle')
    );
    this.menu.appendChild(rectBtn);

    // Polygon option
    const polyBtn = this.createMenuItem(
      '<polygon points="12,2 22,8.5 18,21 6,21 2,8.5" stroke-width="2" fill="none"/>',
      'Draw Polygon',
      this.mode === 'polygon',
      () => this.selectMode('polygon')
    );
    this.menu.appendChild(polyBtn);

    // Divider and cancel/clear options
    if (isDrawing || this.hasResults) {
      const divider = document.createElement('div');
      divider.style.cssText = 'border-top: 1px solid #e5e7eb; margin: 4px 0;';
      this.menu.appendChild(divider);

      if (isDrawing) {
        const cancelBtn = this.createMenuItem(
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>',
          'Cancel Drawing',
          false,
          () => this.selectMode('off'),
          true
        );
        this.menu.appendChild(cancelBtn);
      }

      if (this.hasResults && !isDrawing) {
        const clearBtn = this.createMenuItem(
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>',
          'Clear Selection',
          false,
          () => { this.onClear?.(); this.closeMenu(); },
          true
        );
        this.menu.appendChild(clearBtn);
      }
    }
  }

  private createMenuItem(
    iconPath: string,
    label: string,
    isActive: boolean,
    onClick: () => void,
    isDanger: boolean = false
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      text-align: left;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      border: none;
      background: ${isActive ? '#eff6ff' : 'transparent'};
      color: ${isDanger ? '#dc2626' : isActive ? '#1d4ed8' : '#374151'};
      cursor: pointer;
    `;

    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        ${iconPath}
      </svg>
      ${label}
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = isDanger ? '#fef2f2' : '#f3f4f6';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = isActive ? '#eff6ff' : 'transparent';
    });
    btn.addEventListener('click', onClick);

    return btn;
  }

  private selectMode(mode: DrawMode): void {
    this.mode = mode;
    this.updateButton();
    this.buildMenu();
    this.closeMenu();
    this.onModeChange?.(mode);
  }

  public setMode(mode: DrawMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.updateButton();
      this.buildMenu();
    }
  }

  public getMode(): DrawMode {
    return this.mode;
  }

  public setHasResults(hasResults: boolean): void {
    if (this.hasResults !== hasResults) {
      this.hasResults = hasResults;
      this.updateButton();
      this.buildMenu();
    }
  }
}
