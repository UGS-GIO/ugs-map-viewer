/**
 * Runtime sprite generator for UCRC box-type symbology.
 *
 * Each well's `box_type_codes` field is a comma-separated, alphabetically-sorted
 * string like "BUTTS,CORE,CUTTINGS,SLABS". We render every well as a centered
 * 2x2 square where each quadrant is fixed to a specific code: present codes
 * get their color, absent codes are dim. The composite is always centered on
 * the true point regardless of how many codes the well has.
 */
import type { Feature } from 'geojson';
import type maplibregl from 'maplibre-gl';

export const BOX_TYPE_CODES = ['BUTTS', 'CORE', 'CUTTINGS', 'SLABS'] as const;
export type BoxTypeCode = typeof BOX_TYPE_CODES[number];

export const BOX_TYPE_COLORS: Record<BoxTypeCode, string> = {
    BUTTS: '#E66101',
    CORE: '#5E3C99',
    CUTTINGS: '#1A9641',
    SLABS: '#0571B0',
};

/** Fixed quadrant assignment so position-per-code is scannable at a glance. */
const QUADRANTS: Array<{ code: BoxTypeCode; row: 0 | 1; col: 0 | 1 }> = [
    { code: 'BUTTS', row: 0, col: 0 },     // top-left
    { code: 'CORE', row: 0, col: 1 },      // top-right
    { code: 'CUTTINGS', row: 1, col: 0 },  // bottom-left
    { code: 'SLABS', row: 1, col: 1 },     // bottom-right
];

const EMPTY_COLOR = 'rgba(180, 180, 180, 0.35)';
const STROKE_COLOR = '#1a1a1a';
const SPRITE_SIZE = 24; // px (rendered at @2x for retina)

export const getBoxTypeSpriteName = (combo: string): string => `box-type-${combo}`;

/** Build a 2x2 split-square sprite for a given comma-separated code combo. */
const drawSprite = (combo: string): ImageData => {
    const present = new Set(combo.split(',').map(s => s.trim()).filter(Boolean));
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_SIZE;
    canvas.height = SPRITE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    const half = SPRITE_SIZE / 2;

    for (const { code, row, col } of QUADRANTS) {
        ctx.fillStyle = present.has(code) ? BOX_TYPE_COLORS[code] : EMPTY_COLOR;
        ctx.fillRect(col * half, row * half, half, half);
    }

    // Inner cross divider + outer border
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(half, 0);
    ctx.lineTo(half, SPRITE_SIZE);
    ctx.moveTo(0, half);
    ctx.lineTo(SPRITE_SIZE, half);
    ctx.stroke();
    ctx.strokeRect(0.5, 0.5, SPRITE_SIZE - 1, SPRITE_SIZE - 1);

    return ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
};

/**
 * Walk features, collect every distinct box_type_codes value, and register a sprite
 * for each one with the given map. Idempotent — sprites already in the map are skipped.
 */
export const registerBoxTypeSprites = (map: maplibregl.Map, features: Feature[]): void => {
    const combos = new Set<string>();
    for (const f of features) {
        const v = f.properties?.box_type_codes;
        if (typeof v === 'string' && v.trim()) combos.add(v.trim());
    }
    for (const combo of combos) {
        const name = getBoxTypeSpriteName(combo);
        if (map.hasImage(name)) continue;
        try {
            map.addImage(name, drawSprite(combo), { pixelRatio: 1 });
        } catch (err) {
            console.warn(`[box-type-sprites] failed to register ${name}:`, err);
        }
    }
};
