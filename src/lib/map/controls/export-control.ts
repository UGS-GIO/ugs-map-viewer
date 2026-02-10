/**
 * Custom Map Export Control
 * Based on @watergis/maplibre-gl-export (MIT License - Jin IGARASHI, 2020)
 * Adapted for UGS styling and theme integration
 */
import maplibregl from 'maplibre-gl';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Printer, X } from 'lucide-react';

export type PageSize = 'A4' | 'A3' | 'Letter' | 'Tabloid';
export type PageOrientation = 'landscape' | 'portrait';
export type ExportFormat = 'png' | 'jpeg' | 'pdf';
export type DPI = 96 | 150 | 200 | 300;
export type ScaleUnit = 'metric' | 'imperial';

export interface LegendItem {
    layerTitle: string;
    symbols: Array<{
        label: string;
        svgHtml: string;
    }>;
}

export interface MapBounds {
    west: number;
    south: number;
    east: number;
    north: number;
    width: number;
    height: number;
}

export type LegendMode = 'none' | 'on-map' | 'separate';

export interface ExportControlOptions {
    pageSize?: PageSize;
    pageOrientation?: PageOrientation;
    format?: ExportFormat;
    dpi?: DPI;
    filename?: string;
    scaleUnit?: ScaleUnit;
    /** Callback to get legend data for visible layers (receives map bounds for filtering) */
    getLegendData?: (bounds: MapBounds) => Promise<LegendItem[]>;
}

interface PageDimensions {
    width: number;
    height: number;
}

const PAGE_SIZES: Record<PageSize, PageDimensions> = {
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 },
    Letter: { width: 215.9, height: 279.4 },
    Tabloid: { width: 279.4, height: 431.8 },
};

/**
 * Export Control - generates map images/PDFs
 * Implements the MapLibre GL JS IControl interface
 */
export class ExportControl implements maplibregl.IControl {
    private map?: maplibregl.Map;
    private container?: HTMLElement;
    private toggleButton?: HTMLButtonElement;
    private panel?: HTMLElement;
    private isOpen = false;

    // Current settings
    private pageSize: PageSize;
    private pageOrientation: PageOrientation;
    private format: ExportFormat;
    private dpi: DPI;
    private filename: string;
    private scaleUnit: ScaleUnit;
    private legendMode: LegendMode;
    private getLegendData?: (bounds: MapBounds) => Promise<LegendItem[]>;

    constructor(options: ExportControlOptions = {}) {
        this.pageSize = options.pageSize ?? 'A4';
        this.pageOrientation = options.pageOrientation ?? 'landscape';
        this.format = options.format ?? 'png';
        this.dpi = options.dpi ?? 300;
        this.filename = options.filename ?? 'map-export';
        this.scaleUnit = options.scaleUnit ?? 'imperial';
        this.legendMode = 'on-map';
        this.getLegendData = options.getLegendData;
    }

    onAdd(map: maplibregl.Map): HTMLElement {
        this.map = map;

        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        // Toggle button
        this.toggleButton = this.createToggleButton();
        this.toggleButton.addEventListener('click', () => this.toggle());

        this.container.appendChild(this.toggleButton);

        // Click outside to close
        document.addEventListener('click', this.handleOutsideClick);

        return this.container;
    }

    onRemove(): void {
        document.removeEventListener('click', this.handleOutsideClick);
        this.closePanel();
        this.container?.parentNode?.removeChild(this.container);
        this.map = undefined;
    }

    private handleOutsideClick = (e: MouseEvent) => {
        if (this.isOpen && this.container && !this.container.contains(e.target as Node)) {
            this.closePanel();
        }
    };

    private createToggleButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'maplibregl-ctrl-icon';
        button.type = 'button';
        button.title = 'Export map';
        button.setAttribute('aria-label', 'Export map');
        button.setAttribute('data-tour', 'print-map');
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.color = '#333';

        const iconElement = createElement(Printer, { size: 20, strokeWidth: 2 });
        button.innerHTML = renderToStaticMarkup(iconElement);

        return button;
    }

    private toggle(): void {
        if (this.isOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    private openPanel(): void {
        if (this.isOpen || !this.container) return;

        this.panel = document.createElement('div');
        this.panel.className = 'absolute top-full left-0 mt-1 min-w-[200px] bg-popover border border-border rounded-md shadow-md p-2 z-10 overflow-hidden';

        // Header with close button
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center pb-1 mb-1.5 border-b border-border';

        const title = document.createElement('span');
        title.textContent = 'Export Map';
        title.className = 'text-xs font-medium text-foreground leading-none';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'bg-transparent border-none cursor-pointer p-0 flex items-center justify-center text-muted-foreground hover:text-foreground';
        closeBtn.style.width = '16px';
        closeBtn.style.height = '16px';
        closeBtn.innerHTML = renderToStaticMarkup(createElement(X, { size: 14 }));
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closePanel();
        });

        header.appendChild(title);
        header.appendChild(closeBtn);
        this.panel.appendChild(header);

        // Options
        this.panel.appendChild(this.createSelect('Size', 'pageSize', ['A4', 'A3', 'Letter', 'Tabloid'], this.pageSize));
        this.panel.appendChild(this.createSelect('Orientation', 'pageOrientation', ['landscape', 'portrait'], this.pageOrientation));
        this.panel.appendChild(this.createSelect('Format', 'format', ['png', 'jpeg', 'pdf'], this.format));
        this.panel.appendChild(this.createSelect('Quality', 'dpi', ['96', '150', '200', '300'], String(this.dpi)));
        this.panel.appendChild(this.createSelect('Scale', 'scaleUnit', ['imperial', 'metric'], this.scaleUnit, { imperial: 'mi/ft', metric: 'km/m' }));

        // Legend mode select (only show if getLegendData is available)
        if (this.getLegendData) {
            this.panel.appendChild(this.createSelect('Legend', 'legendMode', ['on-map', 'separate', 'none'], this.legendMode, {
                'on-map': 'On Map',
                'separate': 'Separate',
                'none': 'None'
            }));
        }

        // Export button - using inline styles since Tailwind purges dynamic classes
        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.id = 'export-map-btn';
        exportBtn.textContent = 'Export';
        exportBtn.style.cssText = `
            width: 100%;
            margin-top: 8px;
            padding: 6px 16px;
            background-color: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            text-align: center;
            line-height: 1.4;
            display: block;
        `;
        exportBtn.addEventListener('mouseenter', () => exportBtn.style.opacity = '0.9');
        exportBtn.addEventListener('mouseleave', () => exportBtn.style.opacity = '1');
        exportBtn.addEventListener('click', () => this.exportMap());
        this.panel.appendChild(exportBtn);

        this.container.appendChild(this.panel);
        this.isOpen = true;
    }

    private closePanel(): void {
        if (!this.isOpen) return;

        this.panel?.remove();
        this.panel = undefined;
        this.isOpen = false;
    }

    private createSelect(
        label: string,
        key: string,
        options: string[],
        currentValue: string,
        labelMap?: Record<string, string>
    ): HTMLElement {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center mb-1.5';

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.className = 'text-xs text-foreground';

        const select = document.createElement('select');
        select.className = 'py-0.5 px-1.5 text-xs border border-input rounded bg-background text-foreground cursor-pointer';

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            // Use custom label if provided, otherwise capitalize first letter
            option.textContent = labelMap?.[opt] ?? (opt.charAt(0).toUpperCase() + opt.slice(1));
            if (opt === currentValue) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            (this as any)[key] = key === 'dpi' ? parseInt(select.value) : select.value;
        });

        row.appendChild(labelEl);
        row.appendChild(select);
        return row;
    }

    private async exportMap(): Promise<void> {
        if (!this.map) return;

        const exportBtn = this.panel?.querySelector('#export-map-btn') as HTMLButtonElement;
        if (exportBtn) {
            exportBtn.textContent = 'Exporting...';
            exportBtn.disabled = true;
        }

        try {
            // Calculate dimensions based on page size and DPI
            const pageDims = PAGE_SIZES[this.pageSize];
            const width = this.pageOrientation === 'landscape' ? pageDims.height : pageDims.width;
            const height = this.pageOrientation === 'landscape' ? pageDims.width : pageDims.height;

            // Convert mm to pixels at specified DPI
            const pixelWidth = Math.round((width / 25.4) * this.dpi);
            const pixelHeight = Math.round((height / 25.4) * this.dpi);

            // Use the map's renderToCanvas or generate from current view
            const canvas = await this.generateCanvas(pixelWidth, pixelHeight);

            if (this.format === 'pdf') {
                await this.exportAsPdf(canvas, width, height);
            } else {
                this.exportAsImage(canvas);
            }

            // Export separate legend if mode is 'separate'
            if (this.legendMode === 'separate' && this.getLegendData && this.map) {
                const mapBounds = this.map.getBounds();
                const bounds: MapBounds = {
                    west: mapBounds.getWest(),
                    south: mapBounds.getSouth(),
                    east: mapBounds.getEast(),
                    north: mapBounds.getNorth(),
                    width: pixelWidth,
                    height: pixelHeight
                };
                const legendData = await this.getLegendData(bounds);
                if (legendData.length > 0) {
                    const scale = this.dpi / 96;
                    const legendCanvas = await this.generateLegendCanvas(legendData, scale);
                    this.exportAsImage(legendCanvas, `${this.filename}-legend`);
                }
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        } finally {
            if (exportBtn) {
                exportBtn.textContent = 'Export';
                exportBtn.disabled = false;
            }
            this.closePanel();
        }
    }

    private async generateCanvas(width: number, height: number): Promise<HTMLCanvasElement> {
        if (!this.map) throw new Error('Map not available');

        // Capture current view bounds before creating export map
        const currentBounds = this.map.getBounds();
        const bearing = this.map.getBearing();
        const pitch = this.map.getPitch();

        // Create a hidden container for rendering (offscreen to avoid visual artifacts)
        const hiddenContainer = document.createElement('div');
        hiddenContainer.style.cssText = `
            position: fixed;
            left: -9999px;
            top: -9999px;
            width: ${width}px;
            height: ${height}px;
            visibility: hidden;
            pointer-events: none;
        `;
        document.body.appendChild(hiddenContainer);

        // Create a new map instance for export
        // Use fitBoundsOptions instead of center/zoom so the export shows the same
        // geographic extent regardless of the (much larger) export container size.
        const exportMap = new maplibregl.Map({
            container: hiddenContainer,
            style: this.map.getStyle(),
            bounds: currentBounds,
            fitBoundsOptions: { padding: 0 },
            bearing,
            pitch,
            interactive: false,
            attributionControl: false,
        });

        // Wait for map to fully render
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Map render timeout')), 30000);
            exportMap.once('idle', () => {
                clearTimeout(timeout);
                resolve();
            });
            exportMap.once('error', (e) => {
                clearTimeout(timeout);
                reject(e);
            });
        });

        // Get canvas
        const canvas = exportMap.getCanvas();

        // Fetch legend data if needed (with map bounds for content-dependent filtering)
        let legendData: LegendItem[] = [];
        if (this.legendMode !== 'none' && this.getLegendData) {
            try {
                const mapBounds = exportMap.getBounds();
                const bounds: MapBounds = {
                    west: mapBounds.getWest(),
                    south: mapBounds.getSouth(),
                    east: mapBounds.getEast(),
                    north: mapBounds.getNorth(),
                    width,
                    height
                };
                legendData = await this.getLegendData(bounds);
            } catch (e) {
                console.warn('Failed to fetch legend data:', e);
            }
        }

        // Create a copy of the canvas
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = canvas.width;
        outputCanvas.height = canvas.height;
        const ctx = outputCanvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(canvas, 0, 0);

            // Add overlays
            const scale = this.dpi / 96; // Scale factor for high DPI
            const bearing = exportMap.getBearing();
            this.drawNorthArrow(ctx, outputCanvas.width, scale, bearing);
            this.drawScaleBar(ctx, outputCanvas.width, outputCanvas.height, exportMap, scale, this.scaleUnit);
            this.drawAttribution(ctx, outputCanvas.width, outputCanvas.height, scale);

            // Draw legend on map if mode is 'on-map'
            if (this.legendMode === 'on-map' && legendData.length > 0) {
                await this.drawLegend(ctx, outputCanvas.width, outputCanvas.height, scale, legendData);
            }
        }

        // Cleanup
        exportMap.remove();
        hiddenContainer.remove();

        return outputCanvas;
    }

    private drawNorthArrow(ctx: CanvasRenderingContext2D, canvasWidth: number, scale: number, bearing: number): void {
        const size = 40 * scale;
        const marginX = 16 * scale;
        const marginY = 32 * scale; // More top padding
        const x = canvasWidth - marginX - size / 2;
        const y = marginY + size / 2;

        ctx.save();
        ctx.translate(x, y);

        // White background circle (doesn't rotate)
        ctx.beginPath();
        ctx.arc(0, 0, size / 2 + 4 * scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1 * scale;
        ctx.stroke();

        // Rotate arrow based on map bearing (convert to radians, negate for correct direction)
        ctx.rotate(-bearing * Math.PI / 180);

        // North arrow
        ctx.beginPath();
        ctx.moveTo(0, -size / 2 + 4 * scale);
        ctx.lineTo(-size / 4, size / 4);
        ctx.lineTo(0, size / 8);
        ctx.lineTo(size / 4, size / 4);
        ctx.closePath();
        ctx.fillStyle = '#333';
        ctx.fill();

        // "N" label (moves with arrow)
        ctx.fillStyle = '#333';
        ctx.font = `bold ${12 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', 0, -size / 2 - 10 * scale);

        ctx.restore();
    }

    private drawScaleBar(
        ctx: CanvasRenderingContext2D,
        _canvasWidth: number,
        canvasHeight: number,
        map: maplibregl.Map,
        scale: number,
        scaleUnit: ScaleUnit
    ): void {
        const margin = 16 * scale;
        const barHeight = 8 * scale;
        const y = canvasHeight - margin - barHeight;

        // Calculate scale based on map center latitude
        const center = map.getCenter();
        const zoom = map.getZoom();
        const metersPerPixel = (40075016.686 * Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom + 8);

        // Find a nice round distance
        const maxBarWidth = 150 * scale;
        const maxMeters = maxBarWidth * metersPerPixel;

        let distance: number;
        let unit: string;
        let barWidth: number;

        // Conversion constants
        const METERS_PER_MILE = 1609.344;
        const METERS_PER_FOOT = 0.3048;

        if (scaleUnit === 'imperial') {
            // Imperial units (miles/feet)
            const maxFeet = maxMeters / METERS_PER_FOOT;
            const maxMiles = maxMeters / METERS_PER_MILE;

            if (maxMiles >= 0.25) {
                // Use miles
                const niceMiles = this.getNiceNumber(maxMiles);
                distance = niceMiles;
                unit = 'mi';
                barWidth = (niceMiles * METERS_PER_MILE / metersPerPixel);
            } else {
                // Use feet
                const niceFeet = this.getNiceNumber(maxFeet);
                distance = niceFeet;
                unit = 'ft';
                barWidth = (niceFeet * METERS_PER_FOOT / metersPerPixel);
            }
        } else {
            // Metric units (km/m)
            if (maxMeters >= 1000) {
                // Use kilometers
                const km = maxMeters / 1000;
                const niceKm = this.getNiceNumber(km);
                distance = niceKm;
                unit = 'km';
                barWidth = (niceKm * 1000 / metersPerPixel);
            } else {
                // Use meters
                const niceM = this.getNiceNumber(maxMeters);
                distance = niceM;
                unit = 'm';
                barWidth = niceM / metersPerPixel;
            }
        }

        const x = margin;
        const label = `${distance} ${unit}`;
        const barColor = scaleUnit === 'imperial' ? '#374151' : '#6b7280';
        const textHeight = 14 * scale;
        const gap = 4 * scale;
        const padding = 8 * scale;

        // Calculate background size
        const totalHeight = padding + textHeight + gap + barHeight + padding;
        const totalWidth = barWidth + padding * 2;
        const bgY = y - textHeight - gap - padding;

        // Rounded background (matching DualScaleControl style)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.roundRect(x - padding, bgY, totalWidth, totalHeight, 4 * scale);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1 * scale;
        ctx.stroke();

        // Label above bar
        ctx.fillStyle = barColor;
        ctx.font = `${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x, bgY + padding);

        // Solid scale bar (matching DualScaleControl)
        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, barWidth, barHeight);

        // End caps (vertical lines)
        ctx.fillRect(x, y - 2 * scale, 2 * scale, barHeight + 4 * scale);
        ctx.fillRect(x + barWidth - 2 * scale, y - 2 * scale, 2 * scale, barHeight + 4 * scale);
    }

    private getNiceNumber(value: number): number {
        const exp = Math.floor(Math.log10(value));
        const fraction = value / Math.pow(10, exp);

        let niceFraction: number;
        if (fraction < 1.5) niceFraction = 1;
        else if (fraction < 3) niceFraction = 2;
        else if (fraction < 7) niceFraction = 5;
        else niceFraction = 10;

        return niceFraction * Math.pow(10, exp);
    }

    private drawAttribution(
        ctx: CanvasRenderingContext2D,
        canvasWidth: number,
        canvasHeight: number,
        scale: number
    ): void {
        const margin = 16 * scale;
        const text = '© Utah Geological Survey | OpenStreetMap contributors';

        ctx.font = `${10 * scale}px sans-serif`;
        const textWidth = ctx.measureText(text).width;

        const x = canvasWidth - margin - textWidth - 8 * scale;
        const y = canvasHeight - margin;

        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(x - 4 * scale, y - 14 * scale, textWidth + 8 * scale, 18 * scale);

        // Text
        ctx.fillStyle = '#666';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, x, y);
    }

    private async drawLegend(
        ctx: CanvasRenderingContext2D,
        _canvasWidth: number,
        canvasHeight: number,
        scale: number,
        legendData: LegendItem[]
    ): Promise<void> {
        const margin = 16 * scale;
        const padding = 10 * scale;
        const symbolSize = 24 * scale;
        const rowHeight = 18 * scale;
        const titleHeight = 16 * scale;
        const layerGap = 8 * scale;

        // Calculate total height needed
        let totalHeight = padding * 2;
        for (const layer of legendData) {
            totalHeight += titleHeight + layerGap;
            totalHeight += layer.symbols.length * rowHeight;
        }

        // Max height: leave room for scale bar (60px) and some margin from top (100px)
        const maxHeight = canvasHeight - margin - 60 * scale - 100 * scale;
        const constrainedHeight = Math.min(totalHeight, maxHeight);

        // Position in bottom-left, above scale bar
        const maxWidth = 200 * scale;
        const x = margin;
        const y = canvasHeight - margin - constrainedHeight - 60 * scale;

        // Background with rounded corners
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(x, y, maxWidth, constrainedHeight, 4 * scale);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1 * scale;
        ctx.stroke();

        // Clip to legend bounds
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, maxWidth, constrainedHeight, 4 * scale);
        ctx.clip();

        let currentY = y + padding;

        for (const layer of legendData) {
            // Stop if we've exceeded the constrained height
            if (currentY > y + constrainedHeight - padding) break;

            // Layer title
            ctx.fillStyle = '#333';
            ctx.font = `bold ${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(layer.layerTitle, x + padding, currentY, maxWidth - padding * 2);
            currentY += titleHeight;

            // Symbols
            ctx.font = `${10 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            for (const symbol of layer.symbols) {
                if (currentY > y + constrainedHeight - padding) break;

                // Draw symbol (convert SVG to image)
                try {
                    const img = await this.svgToImage(symbol.svgHtml, symbolSize, symbolSize);
                    ctx.drawImage(img, x + padding, currentY, symbolSize, rowHeight - 2 * scale);
                } catch {
                    // Draw placeholder rectangle if SVG fails
                    ctx.fillStyle = '#ccc';
                    ctx.fillRect(x + padding, currentY + 2 * scale, symbolSize, rowHeight - 4 * scale);
                }

                // Label
                ctx.fillStyle = '#666';
                ctx.textBaseline = 'middle';
                ctx.fillText(symbol.label, x + padding + symbolSize + 6 * scale, currentY + rowHeight / 2, maxWidth - padding * 2 - symbolSize - 10 * scale);
                currentY += rowHeight;
            }

            currentY += layerGap;
        }

        ctx.restore();
    }

    private svgToImage(svgHtml: string, width: number, height: number): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            // Ensure SVG has proper XML namespace and dimensions
            let processedSvg = svgHtml;

            // Add xmlns if missing
            if (!processedSvg.includes('xmlns=')) {
                processedSvg = processedSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
            }

            // Replace currentColor with a visible color
            processedSvg = processedSvg.replace(/currentColor/g, '#333333');

            // Convert 8-digit hex colors (#RRGGBBAA) to rgba() format for better compatibility
            processedSvg = processedSvg.replace(/#([0-9A-Fa-f]{8})\b/g, (_match, hex) => {
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                const a = parseInt(hex.slice(6, 8), 16) / 255;
                return `rgba(${r},${g},${b},${a.toFixed(2)})`;
            });

            // Encode SVG properly for data URL (more reliable than blob)
            const encodedSvg = encodeURIComponent(processedSvg)
                .replace(/'/g, '%27')
                .replace(/"/g, '%22');

            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load SVG'));
            img.width = width;
            img.height = height;
            img.src = `data:image/svg+xml,${encodedSvg}`;
        });
    }

    private async generateLegendCanvas(legendData: LegendItem[], scale: number): Promise<HTMLCanvasElement> {
        const padding = 16 * scale;
        const symbolSize = 32 * scale;
        const rowHeight = 24 * scale;
        const titleHeight = 20 * scale;
        const layerGap = 12 * scale;
        const maxWidth = 300 * scale;

        // Calculate dimensions
        let totalHeight = padding * 2;
        for (const layer of legendData) {
            totalHeight += titleHeight + layerGap;
            totalHeight += layer.symbols.length * rowHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        // White background
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, maxWidth, totalHeight);

        let currentY = padding;

        for (const layer of legendData) {
            // Layer title
            ctx.fillStyle = '#333';
            ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(layer.layerTitle, padding, currentY, maxWidth - padding * 2);
            currentY += titleHeight;

            // Symbols
            ctx.font = `${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            for (const symbol of layer.symbols) {
                try {
                    const img = await this.svgToImage(symbol.svgHtml, symbolSize, symbolSize);
                    ctx.drawImage(img, padding, currentY, symbolSize, rowHeight - 4 * scale);
                } catch {
                    ctx.fillStyle = '#ccc';
                    ctx.fillRect(padding, currentY + 2 * scale, symbolSize, rowHeight - 4 * scale);
                }

                ctx.fillStyle = '#333';
                ctx.textBaseline = 'middle';
                ctx.fillText(symbol.label, padding + symbolSize + 8 * scale, currentY + rowHeight / 2, maxWidth - padding * 2 - symbolSize - 12 * scale);
                currentY += rowHeight;
            }

            currentY += layerGap;
        }

        return canvas;
    }

    private exportAsImage(canvas: HTMLCanvasElement, filename?: string): void {
        const mimeType = this.format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const extension = this.format === 'jpeg' ? 'jpg' : 'png';
        const name = filename ?? this.filename;

        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${name}.${extension}`;
            link.click();
            URL.revokeObjectURL(url);
        }, mimeType, 0.95);
    }

    private async exportAsPdf(canvas: HTMLCanvasElement, widthMm: number, heightMm: number): Promise<void> {
        // Dynamically import jspdf
        const { jsPDF } = await import('jspdf');

        const pdf = new jsPDF({
            orientation: this.pageOrientation,
            unit: 'mm',
            format: [widthMm, heightMm],
        });

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
        pdf.save(`${this.filename}.pdf`);
    }
}
