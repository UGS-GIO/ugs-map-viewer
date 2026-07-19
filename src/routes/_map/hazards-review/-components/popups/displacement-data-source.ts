/**
 * Displacement data source switch. hazards-review pulls features from public GeoServer WFS; /review-stac
 * pulls them from the review geoparquet (duckdb-wasm, same-origin behind IAP) — same DisplacementFeature
 * shape, so every chart/filter/legend hook works unchanged. Default is WFS (no provider needed).
 */
import { createContext, useContext } from 'react';
import type { Polygon } from 'geojson';
import { withConnection, escapeSql, normalizeRow } from '@/lib/duckdb/client';
import type { DisplacementFeature, DisplacementProps } from './use-displacement-queries';
import type { SldBin } from './displacement-sld-legend';

// parquet source also carries the per-GeoServer-style-name GL style URL, so displacement bins (chart
// breaks + colors) come from the review GL style — never GeoServer SLD.
export type DisplacementDataSource =
    | { kind: 'wfs' }
    | { kind: 'parquet'; parquetUrl: string; glStyleUrlByStyle?: Record<string, string> };

/** Parse the value breaks + colors out of a review GL style fragment into SldBin[] (the chart's bins).
 *  Each fill layer filters `value_inch` by a half-open range; the zero deadband spans across 0. */
export function parseGlStyleBins(style: {
    layers?: Array<{ type?: string; paint?: Record<string, unknown>; filter?: unknown; metadata?: Record<string, unknown> }>;
}): SldBin[] {
    const bins: SldBin[] = [];
    const seen = new Set<string>();
    const bounds = (filter: unknown): { min: number; max: number } | null => {
        let min = -Infinity, max = Infinity, found = false;
        const walk = (e: unknown) => {
            if (!Array.isArray(e)) return;
            const op = e[0];
            if (op === '!') return; // skip the negated deadband exclusion
            if (op === 'all' || op === 'any') { e.slice(1).forEach(walk); return; }
            if (op === '>=' || op === '>' || op === '<=' || op === '<') {
                const g = e[1], v = e[2];
                if (Array.isArray(g) && g[0] === 'get' && g[1] === 'value_inch' && typeof v === 'number') {
                    found = true;
                    if (op === '>=' || op === '>') min = Math.max(min, v);
                    if (op === '<=' || op === '<') max = Math.min(max, v);
                }
            }
        };
        walk(filter);
        return found ? { min, max } : null;
    };
    for (const l of style.layers ?? []) {
        if (l.type !== 'fill') continue;
        const color = l.paint?.['fill-color'];
        if (typeof color !== 'string') continue;
        const b = bounds(l.filter);
        if (!b) continue;
        const key = `${b.min}|${b.max}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // Prefer the SLD rule identity the style publishes (ugs-styles #12). The deadband is NOT inferable
        // from bounds: velocity's deadband is the rule named `Zero` ([-0.001, 0.001]) while its class_9
        // ([-0.075, 0.075]) also spans zero but is real data. Fall back to the span-zero guess only for
        // styles published before that metadata existed.
        const meta = l.metadata ?? {};
        const ruleName = typeof meta['ugs:rule'] === 'string' ? (meta['ugs:rule'] as string) : undefined;
        const ruleTitle = typeof meta['ugs:title'] === 'string' ? (meta['ugs:title'] as string) : undefined;
        const isZero =
            typeof meta['ugs:zero'] === 'boolean' ? (meta['ugs:zero'] as boolean) : b.min < 0 && b.max > 0;
        bins.push({
            name: ruleName ?? `gl_${b.min}_${b.max}`,
            title: ruleTitle || binTitle(b.min, b.max, isZero),
            min: b.min,
            max: b.max,
            color,
            isZero,
        });
    }
    bins.sort((a, b) => a.min - b.min);
    return bins;
}

function binTitle(min: number, max: number, isZero: boolean): string {
    if (isZero) return `within ±${Math.max(Math.abs(min), Math.abs(max))} in`;
    if (min === -Infinity) return `< ${max} in`;
    if (max === Infinity) return `≥ ${min} in`;
    return `${min} – ${max} in`;
}

/** Fetch a review GL style URL and parse its value bins. () on any failure (charts degrade gracefully). */
export async function fetchGlStyleBins(styleUrl: string | undefined): Promise<SldBin[]> {
    if (!styleUrl) return [];
    try {
        const res = await fetch(styleUrl);
        if (!res.ok) return [];
        return parseGlStyleBins(await res.json());
    } catch {
        return [];
    }
}

const DisplacementSourceContext = createContext<DisplacementDataSource>({ kind: 'wfs' });
export const DisplacementSourceProvider = DisplacementSourceContext.Provider;
export const useDisplacementSource = (): DisplacementDataSource => useContext(DisplacementSourceContext);

/** Stable cache-key fragment for a source (so react-query separates WFS vs each parquet url). */
export const sourceKey = (s: DisplacementDataSource): string => (s.kind === 'parquet' ? s.parquetUrl : 'wfs');

/**
 * Read the review displacement geoparquet and map rows to DisplacementFeature. Charts read properties;
 * combinedBbox needs geometry, so build a cheap bbox polygon from the parquet's bbox_* columns (no WKB
 * parse). Column names verified against the review parquet (type/year/location/data_qual/value_inches/…).
 */
export async function fetchDisplacementFromParquet(parquetUrl: string): Promise<DisplacementFeature[]> {
  // Only the columns the charts/filters need — NOT geom (large WKB; combinedBbox uses the bbox_* cols).
  const rows = await withConnection(async (conn) => {
    // Cast the date columns to ISO strings — they're timestamps in the parquet, and getBucketYear does
    // end_date.slice(0,4). Without the cast duckdb hands back epoch ms and the "year" reads off that
    // (e.g. "1728…"), breaking the year selector + all year-bucketed charts.
    const res = await conn.query(
      `SELECT location, type, year,
              CAST(start_date AS VARCHAR) AS start_date, CAST(end_date AS VARCHAR) AS end_date,
              value_inches, pct_valid, data_qual,
              bbox_xmin, bbox_ymin, bbox_xmax, bbox_ymax
       FROM read_parquet('${escapeSql(parquetUrl)}')`,
    );
    return res.toArray().map((r) => normalizeRow(r.toJSON() as Record<string, unknown>));
  });
  return rows.map((r): DisplacementFeature => {
    const minx = Number(r.bbox_xmin), miny = Number(r.bbox_ymin), maxx = Number(r.bbox_xmax), maxy = Number(r.bbox_ymax);
    const geometry: Polygon = {
      type: 'Polygon',
      coordinates: [[[minx, miny], [maxx, miny], [maxx, maxy], [minx, maxy], [minx, miny]]],
    };
    const properties: DisplacementProps = {
      location: r.location != null ? String(r.location) : '',
      type: r.type as DisplacementProps['type'],
      year: r.year != null ? String(r.year) : null,
      start_date: r.start_date != null ? String(r.start_date) : null,
      end_date: r.end_date != null ? String(r.end_date) : null,
      value_inch: r.value_inches != null ? Number(r.value_inches) : 0,
      pct_valid: r.pct_valid != null ? Number(r.pct_valid) : null,
      data_qual: r.data_qual != null ? String(r.data_qual) : null,
    };
    return { type: 'Feature', geometry, properties };
  });
}
