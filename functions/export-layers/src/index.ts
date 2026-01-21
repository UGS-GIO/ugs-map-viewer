/**
 * Cloud Function to export layers as Parquet to GCS
 *
 * Triggered by Cloud Scheduler (e.g., nightly)
 * Reads manifest, fetches each layer via WFS, converts to Parquet, uploads to GCS
 */

import * as ff from '@google-cloud/functions-framework';
import { Storage } from '@google-cloud/storage';
import * as duckdb from 'duckdb';
import { z } from 'zod';
import * as fs from 'fs/promises';

// Configuration - set via environment variables
const GCS_BUCKET = process.env.GCS_BUCKET || 'your-exports-bucket';
const MANIFEST_URL = process.env.MANIFEST_URL || 'https://your-app.web.app/export-manifest.json';
const PAGE_SIZE = 5000;

// -----------------------------------------------------------------------------
// Schemas (types inferred from these)
// -----------------------------------------------------------------------------

const ExportManifestEntrySchema = z.object({
  app: z.string(),
  title: z.string(),
  layerName: z.string(),
  wfsUrl: z.string(),
  bucketPath: z.string(),
});

const ExportManifestSchema = z.array(ExportManifestEntrySchema);

const WFSFeatureSchema = z.object({
  type: z.literal('Feature'),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: z.unknown(),
  properties: z.record(z.string(), z.unknown()).nullable(),
});

const WFSResponseSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(WFSFeatureSchema),
  numberMatched: z.number().optional(),
  numberReturned: z.number().optional(),
});

type ExportManifestEntry = z.infer<typeof ExportManifestEntrySchema>;
type WFSResponse = z.infer<typeof WFSResponseSchema>;

const ExportResultSchema = z.object({
  layer: z.string(),
  success: z.boolean(),
  featureCount: z.number().optional(),
  fileSize: z.number().optional(),
  error: z.string().optional(),
});

type ExportResult = z.infer<typeof ExportResultSchema>;

// -----------------------------------------------------------------------------
// DuckDB helpers
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// WFS fetching
// -----------------------------------------------------------------------------

interface FetchPageResult {
  data: WFSResponse;
  useSortBy: boolean;
}

async function fetchWFSPage(
  wfsUrl: string,
  layerName: string,
  startIndex: number,
  useSortBy: boolean
): Promise<FetchPageResult> {
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
    const json = await response.json();
    const data = WFSResponseSchema.parse(json);
    return { data, useSortBy: false };
  }

  if (!response.ok) {
    throw new Error(`WFS request failed: ${response.status}`);
  }

  const json = await response.json();
  const data = WFSResponseSchema.parse(json);
  return { data, useSortBy };
}

// -----------------------------------------------------------------------------
// Layer export
// -----------------------------------------------------------------------------

async function exportLayer(
  entry: ExportManifestEntry,
  storage: Storage,
  dryRun: boolean
): Promise<ExportResult> {
  const db = await createDb();
  const conn = db.connect();

  try {
    console.log(`Exporting ${entry.title}...`);

    // Create table to hold features
    await runQuery(conn, `
      CREATE TABLE features (
        id VARCHAR,
        properties JSON,
        geometry VARCHAR
      )
    `);

    let startIndex = 0;
    let totalFetched = 0;
    let useSortBy = true;

    // Fetch all pages and insert into DuckDB
    while (true) {
      const { data: batch, useSortBy: newUseSortBy } = await fetchWFSPage(
        entry.wfsUrl,
        entry.layerName,
        startIndex,
        useSortBy
      );
      useSortBy = newUseSortBy;

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

      console.log(`  ${entry.title}: ${totalFetched} features fetched...`);

      const returnedCount = batch.numberReturned ?? batch.features.length;
      if (returnedCount < PAGE_SIZE) {
        break;
      }

      startIndex += PAGE_SIZE;
    }

    // Export to local temp file
    const tempPath = `/tmp/${entry.bucketPath.replace(/\//g, '_')}`;
    await runQuery(conn, `
      COPY (SELECT id, properties, geometry FROM features)
      TO '${tempPath}' (FORMAT PARQUET)
    `);

    // Get local file size
    const stats = await fs.stat(tempPath);
    const fileSize = stats.size;

    if (dryRun) {
      console.log(`  ${entry.title}: DRY RUN - wrote ${tempPath} (${totalFetched} features, ${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      // Upload to GCS
      const bucket = storage.bucket(GCS_BUCKET);
      const gcsPath = entry.bucketPath.replace('.geojson', '.parquet');

      await bucket.upload(tempPath, {
        destination: gcsPath,
        metadata: {
          contentType: 'application/vnd.apache.parquet',
          cacheControl: 'public, max-age=86400', // 1 day cache
        },
      });

      console.log(`  ${entry.title}: uploaded to gs://${GCS_BUCKET}/${gcsPath} (${totalFetched} features, ${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    }

    return {
      layer: entry.title,
      success: true,
      featureCount: totalFetched,
      fileSize,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  ${entry.title}: FAILED - ${errorMsg}`);
    return {
      layer: entry.title,
      success: false,
      error: errorMsg,
    };
  } finally {
    conn.close();
    db.close();
  }
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

ff.http('exportLayers', async (req, res) => {
  console.log('Starting layer export job...');

  try {
    // Fetch manifest (support file:// URLs for local testing)
    console.log(`Fetching manifest from ${MANIFEST_URL}...`);
    let json: unknown;
    if (MANIFEST_URL.startsWith('file://')) {
      const filePath = MANIFEST_URL.replace('file://', '');
      const content = await fs.readFile(filePath, 'utf-8');
      json = JSON.parse(content);
    } else {
      const manifestResponse = await fetch(MANIFEST_URL);
      if (!manifestResponse.ok) {
        throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`);
      }
      json = await manifestResponse.json();
    }
    const manifest = ExportManifestSchema.parse(json);
    console.log(`Found ${manifest.length} layers to export`);

    // Optional: filter by app if specified in query params
    const appFilter = typeof req.query.app === 'string' ? req.query.app : undefined;
    const limitFilter = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const dryRun = req.query.dryRun === 'true';

    let layers = manifest;
    if (appFilter) {
      layers = layers.filter(l => l.app === appFilter);
      console.log(`Filtered to ${layers.length} layers for app: ${appFilter}`);
    }
    if (limitFilter && !isNaN(limitFilter)) {
      layers = layers.slice(0, limitFilter);
      console.log(`Limited to first ${limitFilter} layers`);
    }
    if (dryRun) {
      console.log('DRY RUN mode enabled - will not upload to GCS');
    }

    // Initialize GCS client
    const storage = new Storage();

    // Export each layer
    const results: ExportResult[] = [];
    for (const entry of layers) {
      const result = await exportLayer(entry, storage, dryRun);
      results.push(result);
    }

    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalFeatures = successful.reduce((sum, r) => sum + (r.featureCount || 0), 0);
    const totalSize = successful.reduce((sum, r) => sum + (r.fileSize || 0), 0);

    const summary = {
      totalLayers: results.length,
      successful: successful.length,
      failed: failed.length,
      totalFeatures,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      failedLayers: failed.map(f => ({ layer: f.layer, error: f.error })),
    };

    console.log('Export job complete:', summary);

    res.status(200).json({
      status: 'complete',
      ...summary,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Export job failed:', errorMsg);
    res.status(500).json({
      status: 'error',
      error: errorMsg,
    });
  }
});
