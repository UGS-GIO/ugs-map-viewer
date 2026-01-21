/**
 * Local test script for layer exports
 *
 * Run with: npx tsx scripts/test-export-local.ts
 *
 * This script:
 * 1. Reads the export manifest (generate it first with generate-export-manifest.ts)
 * 2. Downloads layers via WFS
 * 3. Writes to ./exports/{app}/{layer}.geojson
 *
 * Options:
 *   --limit N     Only export first N layers (default: 2 for testing)
 *   --app NAME    Only export layers from specific app
 *   --all         Export all layers (no limit)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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
const limitArg = args.find(a => a.startsWith('--limit'));
const appArg = args.find(a => a.startsWith('--app'));
const allFlag = args.includes('--all');

const limit = allFlag ? Infinity : (limitArg ? parseInt(limitArg.split('=')[1] || args[args.indexOf('--limit') + 1] || '2') : 2);
const appFilter = appArg ? (appArg.split('=')[1] || args[args.indexOf('--app') + 1]) : null;

const EXPORTS_DIR = path.join(__dirname, '../exports');
const MANIFEST_PATH = path.join(__dirname, '../public/export-manifest.json');
const PAGE_SIZE = 5000;

/**
 * Fetch a single page of features from WFS
 */
async function fetchWFSPage(
  wfsUrl: string,
  layerName: string,
  startIndex: number,
  useSortBy: boolean
): Promise<{ response: Response; useSortBy: boolean }> {
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
    return { response, useSortBy: false };
  }

  return { response, useSortBy };
}

/**
 * Stream features from WFS directly to a file (low memory usage)
 * Writes valid GeoJSON FeatureCollection without holding all features in RAM
 */
async function streamLayerToFile(
  wfsUrl: string,
  layerName: string,
  outputPath: string,
  onProgress?: (fetched: number, total: number | null) => void
): Promise<{ featureCount: number }> {
  // Ensure directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const writeStream = fs.createWriteStream(outputPath);

  // Write GeoJSON header
  writeStream.write('{"type":"FeatureCollection","features":[\n');

  let startIndex = 0;
  let totalMatched: number | null = null;
  let totalFetched = 0;
  let isFirstFeature = true;
  let useSortBy = true;

  while (true) {
    const { response, useSortBy: newUseSortBy } = await fetchWFSPage(wfsUrl, layerName, startIndex, useSortBy);
    useSortBy = newUseSortBy;

    if (!response.ok) {
      writeStream.close();
      fs.unlinkSync(outputPath); // Clean up partial file
      throw new Error(`WFS request failed: ${response.status} ${response.statusText}`);
    }

    const batch = await response.json() as WFSResponse;

    if (totalMatched === null && batch.numberMatched !== undefined) {
      totalMatched = batch.numberMatched;
    }

    // Write each feature
    for (const feature of batch.features) {
      if (!isFirstFeature) {
        writeStream.write(',\n');
      }
      writeStream.write(JSON.stringify(feature));
      isFirstFeature = false;
      totalFetched++;
    }

    if (onProgress) {
      onProgress(totalFetched, totalMatched);
    }

    const returnedCount = batch.numberReturned ?? batch.features.length;
    if (returnedCount < PAGE_SIZE) {
      break; // Last page
    }

    startIndex += PAGE_SIZE;
  }

  // Write GeoJSON footer
  writeStream.write('\n]}');

  // Wait for stream to finish
  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    writeStream.end();
  });

  return { featureCount: totalFetched };
}

/**
 * Fetch all features from a WFS layer with pagination (legacy - buffers all in memory)
 * Use streamLayerToFile for large layers
 */
async function fetchLayerFeatures(
  wfsUrl: string,
  layerName: string,
  onProgress?: (fetched: number, total: number | null) => void
): Promise<GeoJSON.Feature[]> {
  const allFeatures: GeoJSON.Feature[] = [];
  let startIndex = 0;
  let totalMatched: number | null = null;
  let useSortBy = true;

  while (true) {
    const { response, useSortBy: newUseSortBy } = await fetchWFSPage(wfsUrl, layerName, startIndex, useSortBy);
    useSortBy = newUseSortBy;

    if (!response.ok) {
      throw new Error(`WFS request failed: ${response.status} ${response.statusText}`);
    }

    const batch = await response.json() as WFSResponse;

    if (totalMatched === null && batch.numberMatched !== undefined) {
      totalMatched = batch.numberMatched;
    }

    allFeatures.push(...batch.features);

    if (onProgress) {
      onProgress(allFeatures.length, totalMatched);
    }

    const returnedCount = batch.numberReturned ?? batch.features.length;
    if (returnedCount < PAGE_SIZE) {
      break;
    }

    startIndex += PAGE_SIZE;
  }

  return allFeatures;
}

/**
 * Export a single layer to local filesystem
 */
async function exportLayer(entry: ExportManifestEntry): Promise<{ success: boolean; featureCount: number; error?: string }> {
  const outputPath = path.join(EXPORTS_DIR, entry.bucketPath);

  try {
    console.log(`  Fetching ${entry.layerName}...`);

    const features = await fetchLayerFeatures(
      entry.wfsUrl,
      entry.layerName,
      (fetched, total) => {
        const totalStr = total ? `/${total}` : '';
        process.stdout.write(`\r    ${fetched}${totalStr} features...`);
      }
    );

    console.log(''); // newline after progress

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    // Write file
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    const fileSizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    console.log(`    Wrote ${outputPath} (${features.length} features, ${fileSizeMB} MB)`);

    return { success: true, featureCount: features.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`    ERROR: ${errorMsg}`);
    return { success: false, featureCount: 0, error: errorMsg };
  }
}

async function main() {
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
    console.error(`Available apps: ${[...new Set(manifest.map(e => e.app))].join(', ')}`);
    process.exit(1);
  }

  // Apply limit
  if (limit < layers.length) {
    console.log(`Limiting to first ${limit} layers (use --all to export everything)`);
    layers = layers.slice(0, limit);
  }

  console.log(`\nExporting ${layers.length} layers to ${EXPORTS_DIR}\n`);

  // Export each layer
  const results: { entry: ExportManifestEntry; result: Awaited<ReturnType<typeof exportLayer>> }[] = [];

  for (const entry of layers) {
    console.log(`[${results.length + 1}/${layers.length}] ${entry.title} (${entry.app})`);
    const result = await exportLayer(entry);
    results.push({ entry, result });
  }

  // Summary
  console.log('\n--- Summary ---');
  const successful = results.filter(r => r.result.success);
  const failed = results.filter(r => !r.result.success);
  const totalFeatures = successful.reduce((sum, r) => sum + r.result.featureCount, 0);

  console.log(`Exported: ${successful.length}/${results.length} layers`);
  console.log(`Total features: ${totalFeatures.toLocaleString()}`);

  if (failed.length > 0) {
    console.log(`\nFailed layers:`);
    for (const { entry, result } of failed) {
      console.log(`  - ${entry.title}: ${result.error}`);
    }
  }

  // Calculate total size
  let totalSize = 0;
  for (const { entry, result } of successful) {
    const filePath = path.join(EXPORTS_DIR, entry.bucketPath);
    if (fs.existsSync(filePath)) {
      totalSize += fs.statSync(filePath).size;
    }
  }
  console.log(`Total size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch(console.error);
