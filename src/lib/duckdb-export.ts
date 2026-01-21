/**
 * DuckDB-WASM based export utility
 *
 * Downloads Parquet from GCS, converts to GeoJSON in browser
 * No server-side conversion needed - all client-side!
 */

import * as duckdb from '@duckdb/duckdb-wasm';

// Singleton DuckDB instance
let db: duckdb.AsyncDuckDB | null = null;
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null;

/**
 * Initialize DuckDB-WASM (singleton, reused across calls)
 */
async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Use CDN bundles for WASM files
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

    // Select bundle based on browser capabilities
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();

    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    URL.revokeObjectURL(worker_url);

    return db;
  })();

  return initPromise;
}

export interface ExportProgress {
  stage: 'downloading' | 'converting' | 'complete';
  message: string;
}

export interface ExportOptions {
  /** URL to the Parquet file */
  parquetUrl: string;
  /** Output filename (without extension) */
  filename: string;
  /** Progress callback */
  onProgress?: (progress: ExportProgress) => void;
}

/**
 * Download Parquet from URL and convert to GeoJSON
 * All processing happens in the browser via DuckDB-WASM
 */
export async function exportParquetToGeoJSON(options: ExportOptions): Promise<void> {
  const { parquetUrl, filename, onProgress } = options;

  onProgress?.({ stage: 'downloading', message: 'Downloading data...' });

  // Initialize DuckDB
  const database = await initDuckDB();
  const conn = await database.connect();

  try {
    // Register the remote Parquet file
    // DuckDB-WASM can read directly from URLs
    await conn.query(`
      CREATE OR REPLACE TABLE export_data AS
      SELECT * FROM read_parquet('${parquetUrl}')
    `);

    onProgress?.({ stage: 'converting', message: 'Converting to GeoJSON...' });

    // Query all data
    const result = await conn.query(`
      SELECT id, properties, geometry FROM export_data
    `);

    // Convert to GeoJSON FeatureCollection
    const features: GeoJSON.Feature[] = [];
    const rows = result.toArray();

    for (const row of rows) {
      const rowObj = row.toJSON() as { id: string; properties: string; geometry: string };
      const id = rowObj.id;
      const properties = typeof rowObj.properties === 'string'
        ? JSON.parse(rowObj.properties)
        : rowObj.properties;
      const geometry = typeof rowObj.geometry === 'string'
        ? JSON.parse(rowObj.geometry)
        : rowObj.geometry;

      features.push({
        type: 'Feature',
        id,
        properties,
        geometry,
      });
    }

    const featureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    // Trigger download
    const json = JSON.stringify(featureCollection);
    const blob = new Blob([json], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.geojson`;
    a.click();

    URL.revokeObjectURL(url);

    onProgress?.({ stage: 'complete', message: `Exported ${features.length} features` });

    // Cleanup
    await conn.query('DROP TABLE IF EXISTS export_data');
  } finally {
    await conn.close();
  }
}

/**
 * Download Parquet directly (for users who want Parquet format)
 */
export async function downloadParquet(parquetUrl: string, filename: string): Promise<void> {
  const response = await fetch(parquetUrl);
  const blob = await response.blob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.parquet`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Get the bucket URL for a layer's Parquet export
 */
export function getParquetUrl(app: string, layerTitle: string, bucketBase: string): string {
  const safeName = layerTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${bucketBase}/${app}/${safeName}.parquet`;
}
