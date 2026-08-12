import maplibregl from 'maplibre-gl';

const FEET_PER_METER = 3.28084;
const FEET_PER_MILE = 5280;

interface DualScaleControlOptions {
    maxWidth?: number;
    minWidth?: number;
    position?: 'bottom-left' | 'bottom-right';
    imperialBarColor?: string;
    metricBarColor?: string;
}

/**
 * Custom scale control that displays both imperial and metric units
 * Renders to a canvas layer so it appears in map exports
 */
export class DualScaleControl implements maplibregl.IControl {
    private map: maplibregl.Map | undefined;
    private container: HTMLDivElement | undefined;
    private canvas: HTMLCanvasElement | undefined;
    private maxWidth: number;
    private minWidth: number;
    private position: 'bottom-left' | 'bottom-right';
    private imperialBarColor: string;
    private metricBarColor: string;

    constructor(options: DualScaleControlOptions = {}) {
        this.maxWidth = options.maxWidth ?? 150;
        this.minWidth = options.minWidth ?? 60;
        this.position = options.position ?? 'bottom-left';
        this.imperialBarColor = options.imperialBarColor ?? '#374151';
        this.metricBarColor = options.metricBarColor ?? '#6b7280';
    }

    onAdd(map: maplibregl.Map): HTMLElement {
        this.map = map;

        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-scale-dual';

        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';
        this.container.appendChild(this.canvas);

        this.updateScale();

        map.on('move', this.updateScale);
        map.on('resize', this.updateScale);

        return this.container;
    }

    onRemove(): void {
        if (this.map) {
            this.map.off('move', this.updateScale);
            this.map.off('resize', this.updateScale);
        }
        this.container?.remove();
        this.map = undefined;
    }

    private updateScale = (): void => {
        if (!this.map || !this.canvas) return;

        const metersPerPixel = this.getMetersPerPixel();

        // Calculate distance ranges for min/max width
        const minMeters = metersPerPixel * this.minWidth;
        const maxMeters = metersPerPixel * this.maxWidth;
        const minFeet = minMeters * FEET_PER_METER;
        const maxFeet = maxMeters * FEET_PER_METER;

        // Get nice round numbers for both units (between min and max)
        const metricScale = this.getRoundScale(minMeters, maxMeters, 'metric');
        const imperialScale = this.getRoundScale(minFeet, maxFeet, 'imperial');

        // Calculate pixel widths for each
        const metricWidth = metricScale.distance / metersPerPixel;
        const imperialWidth = (imperialScale.distance / FEET_PER_METER) / metersPerPixel;

        this.render(metricScale, metricWidth, imperialScale, imperialWidth);
    };

    private getMetersPerPixel(): number {
        // Measure the ground distance across a known pixel span at the center of the
        // viewport rather than deriving it from zoom, which requires assuming a tile
        // size (MapLibre uses 512px, not the more commonly quoted 256px) and ignores
        // pitch and bearing.
        const canvas = this.map!.getCanvas();
        const x = canvas.clientWidth / 2;
        const y = canvas.clientHeight / 2;
        const span = Math.min(this.maxWidth, canvas.clientWidth);
        const left = this.map!.unproject([x - span / 2, y]);
        const right = this.map!.unproject([x + span / 2, y]);
        return left.distanceTo(right) / span;
    }

    private getRoundScale(minDistance: number, maxDistance: number, unit: 'metric' | 'imperial'): { distance: number; label: string } {
        // Nice round numbers to use - find largest that fits between min and max
        const roundNumbers = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];

        // Distances are expressed in the small unit (meters / feet)
        const smallUnitLabel = unit === 'metric' ? 'm' : 'ft';
        const largeUnitLabel = unit === 'metric' ? 'km' : 'mi';
        const perLargeUnit = unit === 'metric' ? 1000 : FEET_PER_MILE;

        const candidates: { distance: number; label: string }[] = [];
        for (const n of roundNumbers) {
            if (n < perLargeUnit) {
                candidates.push({ distance: n, label: `${n} ${smallUnitLabel}` });
            }
            candidates.push({ distance: n * perLargeUnit, label: `${n} ${largeUnitLabel}` });
        }
        // Sort ascending so "last one that fits" is genuinely the largest that fits -
        // the interleaved build order above puts e.g. 1 km before 500 m.
        candidates.sort((a, b) => a.distance - b.distance);

        let best = candidates[0];
        for (const c of candidates) {
            if (c.distance >= minDistance && c.distance <= maxDistance) {
                best = c;
            }
        }
        return best;
    }

    private render(
        metricScale: { distance: number; label: string },
        metricWidth: number,
        imperialScale: { distance: number; label: string },
        imperialWidth: number
    ): void {
        if (!this.canvas || !this.container) return;

        const dpr = window.devicePixelRatio || 1;
        const padding = 8;
        const barHeight = 6;
        const textHeight = 14;
        const gap = 4;
        const totalHeight = padding + textHeight + gap + barHeight + gap + barHeight + gap + textHeight + padding;
        // Use fixed width based on maxWidth to prevent jittering
        const totalWidth = padding + this.maxWidth + padding;

        // Set canvas size
        this.canvas.width = totalWidth * dpr;
        this.canvas.height = totalHeight * dpr;
        this.canvas.style.width = `${totalWidth}px`;
        this.canvas.style.height = `${totalHeight}px`;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(dpr, dpr);

        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.roundRect(0, 0, totalWidth, totalHeight, 4);
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.roundRect(0, 0, totalWidth, totalHeight, 4);
        ctx.stroke();

        const x = padding;
        let y = padding;

        // Imperial label (top)
        ctx.fillStyle = this.imperialBarColor;
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(imperialScale.label, x, y);
        y += textHeight + gap;

        // Imperial bar
        this.drawScaleBar(ctx, x, y, imperialWidth, barHeight, this.imperialBarColor);
        y += barHeight + gap;

        // Metric bar
        this.drawScaleBar(ctx, x, y, metricWidth, barHeight, this.metricBarColor);
        y += barHeight + gap;

        // Metric label (bottom)
        ctx.fillStyle = this.metricBarColor;
        ctx.fillText(metricScale.label, x, y);
    }

    private drawScaleBar(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        color: string
    ): void {
        // Main bar
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);

        // End caps (vertical lines)
        ctx.fillRect(x, y - 2, 2, height + 4);
        ctx.fillRect(x + width - 2, y - 2, 2, height + 4);
    }

    getDefaultPosition(): maplibregl.ControlPosition {
        return this.position;
    }
}
