/**
 * Pie-wedge sprite generator for multi-value categorical point symbology.
 *
 * Each feature's `field` is a comma-delimited list of codes. The disc is split
 * into equal wedges in a fixed code order (only present codes drawn), so the
 * colored region is always geometrically centered on the point.
 *
 * Layer-agnostic: consumers pass a config object. Codes/colors live with the
 * layer, not this file.
 */
import type { Feature } from 'geojson';
import type maplibregl from 'maplibre-gl';

export interface PieWedgeConfig {
    /** Feature property holding the comma-delimited code list. */
    field: string;
    /** Ordered code list; wedge order follows this (filters out absent codes). */
    codes: readonly string[];
    /** Code → fill color. */
    colors: Record<string, string>;
    /** Sprite name prefix. Must match the iconImageExpression prefix. */
    namespace: string;
    /** Canvas size in px (default 40). */
    size?: number;
    /** Border/divider stroke width on canvas (default 3). */
    strokeWidth?: number;
    /** Border/divider stroke color (default '#1a1a1a'). */
    strokeColor?: string;
}

const DEFAULT_STROKE_COLOR = '#1a1a1a';
const DEFAULT_SIZE = 40;
const DEFAULT_STROKE_WIDTH = 3;

export const getPieWedgeSpriteName = (namespace: string, combo: string): string =>
    `${namespace}-${combo}`;

const drawSprite = (combo: string, cfg: Required<PieWedgeConfig>): ImageData => {
    const present = new Set(combo.split(',').map(s => s.trim()).filter(Boolean));
    const codes = cfg.codes.filter(c => present.has(c));

    const canvas = document.createElement('canvas');
    canvas.width = cfg.size;
    canvas.height = cfg.size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    const cx = cfg.size / 2;
    const cy = cfg.size / 2;
    const rFill = cfg.size / 2;
    const rStroke = cfg.size / 2 - cfg.strokeWidth / 2;

    if (codes.length === 0) return ctx.getImageData(0, 0, cfg.size, cfg.size);

    const twoPi = Math.PI * 2;
    const sweep = twoPi / codes.length;
    // Start at 9 o'clock (PI) sweeping clockwise, so first wedge = top-left quadrant.
    let angle = Math.PI;

    for (const code of codes) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rFill, angle, angle + sweep);
        ctx.closePath();
        ctx.fillStyle = cfg.colors[code];
        ctx.fill();
        angle += sweep;
    }

    ctx.strokeStyle = cfg.strokeColor;
    ctx.lineWidth = cfg.strokeWidth;

    // Wedge dividers (skip for single-code discs)
    if (codes.length > 1) {
        let a = Math.PI;
        for (let i = 0; i < codes.length; i++) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a) * rStroke, cy + Math.sin(a) * rStroke);
            ctx.stroke();
            a += sweep;
        }
    }

    // Inner-inset outer ring so stroke doesn't clip canvas edge.
    ctx.beginPath();
    ctx.arc(cx, cy, rStroke, 0, twoPi);
    ctx.stroke();

    return ctx.getImageData(0, 0, cfg.size, cfg.size);
};

/**
 * Build a `registerSprites` hook bound to this pie-wedge config. Idempotent —
 * sprites already on the map are skipped.
 */
export const makePieWedgeSpriteRegistrar = (
    config: PieWedgeConfig,
): ((map: maplibregl.Map, features: Feature[]) => void) => {
    const cfg: Required<PieWedgeConfig> = {
        size: DEFAULT_SIZE,
        strokeWidth: DEFAULT_STROKE_WIDTH,
        strokeColor: DEFAULT_STROKE_COLOR,
        ...config,
    };
    return (map, features) => {
        const combos = new Set<string>();
        for (const f of features) {
            const v = f.properties?.[cfg.field];
            if (typeof v === 'string' && v.trim()) combos.add(v.trim());
        }
        for (const combo of combos) {
            const name = getPieWedgeSpriteName(cfg.namespace, combo);
            if (map.hasImage(name)) continue;
            try {
                map.addImage(name, drawSprite(combo, cfg), { pixelRatio: 1 });
            } catch (err) {
                console.warn(`[pie-wedge-sprites] failed to register ${name}:`, err);
            }
        }
    };
};
