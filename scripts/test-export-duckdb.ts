/**
 * DuckDB-based layer export (handles large datasets with low memory)
 *
 * Run with: npx tsx scripts/test-export-duckdb.ts
 *
 * Benefits over in-memory approach:
 * - Out-of-core processing (handles datasets larger than RAM)
 * - Multiple output formats (GeoJSON, Parquet, GeoPackage)
 * - Spatial operations if needed
 *
 * Options:
 *   --limit N       Only export first N layers (default: 2)
 *   --app NAME      Only export layers from specific app
 *   --all           Export all layers
 *   --format FORMAT Output format: geojson (default), parquet
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import duckdb from 'duckdb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExportManifestEntry {
  app: string;
  title: string;
  layerName: string;
  wfsUrl: string;
  bucketPath: string;
}

interface WFSResponse {
  type: 'FeatureCollection';
  features: GeoJSON.Feature[];
  numberMatched?: number;
  numberReturned?: number;
}

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name: string) => {
  const arg = args.find(a => a.startsWith(`--${name}`));
  if (!arg) return null;
  if (arg.includes('=')) return arg.split('=')[1];
  const idx = args.indexOf(`--${name}`);
  return args[idx + 1] || null;
};

const limit = args.includes('--all') ? Infinity : parseInt(getArg('limit') || '2');
const appFilter = getArg('app');
const outputFormat = (getArg('format') || 'geojson') as 'geojson' | 'parquet';

const EXPORTS_DIR = path.join(__dirname, '../exports');
const MANIFEST_PATH = path.join(__dirname, '../public/export-manifest.json');
const PAGE_SIZE = 5000;

/**
 * Create a promisified DuckDB connection
 */
function createDb(): Promise<duckdb.Database> {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(':memory:', (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function runQuery(conn: duckdb.Connection, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function queryAll<T>(conn: duckdb.Connection, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

/**
 * Fetch a single page of features from WFS
 */
async function fetchWFSPage(
  wfsUrl: string,
  layerName: string,
  startIndex: number,
  useSortBy: boolean
): Promise<{ data: WFSResponse; useSortBy: boolean }> {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: layerName,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    startIndex: String(startIndex),
    count: String(PAGE_SIZE),
  });

  if (useSortBy) {
    params.set('sortBy', 'ogc_fid');
  }

  const url = `${wfsUrl}?${params.toString()}`;
  let response = await fetch(url);

  // If sortBy failed on first page, retry without it
  if (!response.ok && useSortBy && startIndex === 0) {
    params.delete('sortBy');
    const retryUrl = `${wfsUrl}?${params.toString()}`;
    response = await fetch(retryUrl);
    if (!response.ok) {
      throw new Error(`WFS request failed: ${response.status}`);
    }
    return { data: await response.json(), useSortBy: false };
  }

  if (!response.ok) {
    throw new Error(`WFS request failed: ${response.status}`);
  }

  return { data: await response.json(), useSortBy };
}

/**
 * Export a layer using DuckDB for memory-efficient processing
 */
async function exportLayerWithDuckDB(
  entry: ExportManifestEntry,
  format: 'geojson' | 'parquet'
): Promise<{ success: boolean; featureCount: number; error?: string }> {
  const ext = format === 'parquet' ? '.parquet' : '.geojson';
  const outputPath = path.join(EXPORTS_DIR, entry.bucketPath.replace('.geojson', ext));

  // Ensure directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const db = await createDb();
  const conn = db.connect();

  try {
    // Install and load spatial extension for geometry handling
    await runQuery(conn, "INSTALL spatial; LOAD spatial;");

    // Create table to hold features
    // We'll store properties as JSON and geometry as WKT
    await runQuery(conn, `
      CREATE TABLE features (
        id VARCHAR,
        properties JSON,
        geometry VARCHAR
      )
    `);

    let startIndex = 0;
    let totalMatched: number | null = null;
    let totalFetched = 0;
    let useSortBy = true;

    console.log(`  Fetching ${entry.layerName}...`);

    // Fetch all pages and insert into DuckDB
    while (true) {
      const { data: batch, useSortBy: newUseSortBy } = await fetchWFSPage(
        entry.wfsUrl,
        entry.layerName,
        startIndex,
        useSortBy
      );
      useSortBy = newUseSortBy;

      if (totalMatched === null && batch.numberMatched !== undefined) {
        totalMatched = batch.numberMatched;
      }

      // Insert features into DuckDB
      for (const feature of batch.features) {
        const id = String(feature.id ?? totalFetched);
        const props = JSON.stringify(feature.properties || {});
        const geom = JSON.stringify(feature.geometry);

        // Escape single quotes for SQL
        const escapedProps = props.replace(/'/g, "''");
        const escapedGeom = geom.replace(/'/g, "''");

        await runQuery(conn, `
          INSERT INTO features VALUES ('${id}', '${escapedProps}', '${escapedGeom}')
        `);
        totalFetched++;
      }

      const totalStr = totalMatched ? `/${totalMatched}` : '';
      process.stdout.write(`\r    ${totalFetched}${totalStr} features...`);

      const returnedCount = batch.numberReturned ?? batch.features.length;
      if (returnedCount < PAGE_SIZE) {
        break;
      }

      startIndex += PAGE_SIZE;
    }

    console.log(''); // newline

    // Export based on format
    if (format === 'parquet') {
      await runQuery(conn, `
        COPY (
          SELECT
            id,
            properties,
            geometry
          FROM features
        ) TO '${outputPath}' (FORMAT PARQUET)
      `);
    } else {
      // For GeoJSON, we need to reconstruct the FeatureCollection
      const rows = await queryAll<{ id: string; properties: string; geometry: string }>(
        conn,
        'SELECT id, properties, geometry FROM features'
      );

      const featureCollection: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: rows.map(row => ({
          type: 'Feature' as const,
          id: row.id,
          properties: JSON.parse(row.properties),
          geometry: JSON.parse(row.geometry),
        })),
      };

      fs.writeFileSync(outputPath, JSON.stringify(featureCollection, null, 2));
    }

    const fileSizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    console.log(`    Wrote ${outputPath} (${totalFetched} features, ${fileSizeMB} MB)`);

    return { success: true, featureCount: totalFetched };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n    ERROR: ${errorMsg}`);
    return { success: false, featureCount: 0, error: errorMsg };
  } finally {
    conn.close();
    db.close();
  }
}

async function main() {
  console.log(`Using DuckDB for memory-efficient export (format: ${outputFormat})\n`);

  // Check manifest exists
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found at ${MANIFEST_PATH}`);
    console.error('Run "npx tsx scripts/generate-export-manifest.ts" first');
    process.exit(1);
  }

  // Load manifest
  const manifest: ExportManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  console.log(`Loaded manifest with ${manifest.length} layers`);

  // Filter by app if specified
  let layers = appFilter
    ? manifest.filter(e => e.app === appFilter)
    : manifest;

  if (appFilter && layers.length === 0) {
    console.error(`No layers found for app: ${appFilter}`);
    process.exit(1);
  }

  // Apply limit
  if (limit < layers.length) {
    console.log(`Limiting to first ${limit} layers (use --all to export everything)`);
    layers = layers.slice(0, limit);
  }

  console.log(`\nExporting ${layers.length} layers to ${EXPORTS_DIR}\n`);

  // Export each layer
  const results: { entry: ExportManifestEntry; result: Awaited<ReturnType<typeof exportLayerWithDuckDB>> }[] = [];

  for (const entry of layers) {
    console.log(`[${results.length + 1}/${layers.length}] ${entry.title} (${entry.app})`);
    const result = await exportLayerWithDuckDB(entry, outputFormat);
    results.push({ entry, result });
  }

  // Summary
  console.log('\n--- Summary ---');
  const successful = results.filter(r => r.result.success);
  const failed = results.filter(r => !r.result.success);
  const totalFeatures = successful.reduce((sum, r) => sum + r.result.featureCount, 0);

  console.log(`Exported: ${successful.length}/${results.length} layers`);
  console.log(`Total features: ${totalFeatures.toLocaleString()}`);
  console.log(`Format: ${outputFormat}`);

  if (failed.length > 0) {
    console.log(`\nFailed layers:`);
    for (const { entry, result } of failed) {
      console.log(`  - ${entry.title}: ${result.error}`);
    }
  }

  // Calculate total size
  let totalSize = 0;
  const ext = outputFormat === 'parquet' ? '.parquet' : '.geojson';
  for (const { entry } of successful) {
    const filePath = path.join(EXPORTS_DIR, entry.bucketPath.replace('.geojson', ext));
    if (fs.existsSync(filePath)) {
      totalSize += fs.statSync(filePath).size;
    }
  }
  console.log(`Total size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch(console.error);
