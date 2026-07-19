/**
 * Displacement data source switch. hazards-review pulls features from public GeoServer WFS; /review-stac
 * pulls them from the review geoparquet (duckdb-wasm, same-origin behind IAP) — same DisplacementFeature
 * shape, so every chart/filter/legend hook works unchanged. Default is WFS (no provider needed).
 */
import { createContext, useContext } from 'react';
import type { Polygon } from 'geojson';
import { withConnection, escapeSql, normalizeRow } from '@/lib/duckdb/client';
import type { DisplacementFeature, DisplacementProps } from './use-displacement-queries';

export type DisplacementDataSource = { kind: 'wfs' } | { kind: 'parquet'; parquetUrl: string };

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
