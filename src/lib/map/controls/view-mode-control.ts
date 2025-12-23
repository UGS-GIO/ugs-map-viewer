import maplibregl from 'maplibre-gl';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Map, Columns2, Table2 } from 'lucide-react';
import type { ViewMode } from '@/hooks/use-map-url-sync';
export type { ViewMode };

export interface ViewModeControlOptions {
    onModeChange?: (mode: ViewMode) => void;
    initialMode?: ViewMode;
}

/**
 * View Mode control - switches between map, split, and table views
 * Implements the MapLibre GL JS IControl interface
 */
export class ViewModeControl implements maplibregl.IControl {
    private container?: HTMLElement;
    private mapButton?: HTMLButtonElement;
    private splitButton?: HTMLButtonElement;
    private tableButton?: HTMLButtonElement;
    private mode: ViewMode = 'map';
    private hasResults: boolean = false;
    private onModeChange?: (mode: ViewMode) => void;

    constructor(options: ViewModeControlOptions = {}) {
        this.onModeChange = options.onModeChange;
        this.mode = options.initialMode || 'map';
    }

    onAdd(): HTMLElement {
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        this.container.style.display = 'flex';
        this.container.style.gap = '0';

        // Map button
        this.mapButton = this.createButton('Map view', Map);
        this.mapButton.addEventListener('click', () => this.setMode('map'));

        // Split button
        this.splitButton = this.createButton('Split view', Columns2, true);
        this.splitButton.addEventListener('click', () => this.setMode('split'));

        // Table button
        this.tableButton = this.createButton('Table view', Table2);
        this.tableButton.addEventListener('click', () => this.setMode('table'));

        this.container.appendChild(this.mapButton);
        this.container.appendChild(this.splitButton);
        this.container.appendChild(this.tableButton);

        this.updateButtonStates();

        return this.container;
    }

    onRemove(): void {
        this.container?.parentNode?.removeChild(this.container);
    }

    private createButton(title: string, icon: any, rotate = false): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'maplibregl-ctrl-icon';
        button.type = 'button';
        button.title = title;
        button.setAttribute('aria-label', title);
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.color = '#333';

        const iconElement = createElement(icon, { size: 18, strokeWidth: 2 });
        button.innerHTML = renderToStaticMarkup(iconElement);

        if (rotate) {
            const svg = button.querySelector('svg');
            if (svg) {
                svg.style.transform = 'rotate(90deg)';
            }
        }

        return button;
    }

    private updateButtonStates(): void {
        if (!this.mapButton || !this.splitButton || !this.tableButton) return;

        // Reset all buttons
        [this.mapButton, this.splitButton, this.tableButton].forEach(btn => {
            btn.style.backgroundColor = '';
            btn.style.color = '#333';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });

        // Highlight active button
        const activeButton = this.mode === 'map' ? this.mapButton
            : this.mode === 'split' ? this.splitButton
            : this.tableButton;

        activeButton.style.backgroundColor = '#0078A8';
        activeButton.style.color = '#fff';

        // Disable split/table if no results
        if (!this.hasResults) {
            [this.splitButton, this.tableButton].forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.4';
                btn.style.cursor = 'not-allowed';
            });
        }
    }

    public setMode(mode: ViewMode): void {
        // Don't allow split/table if no results
        if (!this.hasResults && (mode === 'split' || mode === 'table')) {
            return;
        }

        if (this.mode !== mode) {
            this.mode = mode;
            this.updateButtonStates();
            this.onModeChange?.(mode);
        }
    }

    public getMode(): ViewMode {
        return this.mode;
    }

    public setHasResults(hasResults: boolean): void {
        this.hasResults = hasResults;
        this.updateButtonStates();

        // If we're in split/table but no longer have results, go back to map
        if (!hasResults && (this.mode === 'split' || this.mode === 'table')) {
            this.setMode('map');
        }
    }
}
