/**
 * Build script to generate export manifest for GCS pre-built exports
 *
 * Run with: npx tsx scripts/generate-export-manifest.ts
 *
 * This script:
 * 1. Imports layer configs from each app route
 * 2. Extracts WMS layers that can be exported via WFS
 * 3. Generates a JSON manifest for Cloud Function to use
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import layer configs from each app
// Note: These imports will work because we're running with tsx which handles TypeScript
import hazardsLayers from '../src/routes/_map/hazards/-data/layers/layers';
import carbonstorageLayers from '../src/routes/_map/carbonstorage/-data/layers/layers';
import mineralsLayers from '../src/routes/_map/minerals/-data/layers/layers';
import wetlandsLayers from '../src/routes/_map/wetlands/-data/layers/layers';
import wetlandplantsLayers from '../src/routes/_map/wetlandplants/-data/layers/layers';
import geophysicsLayers from '../src/routes/_map/geophysics/-data/layers/layers';

// Note: hazards-review is excluded - it's a protected route requiring authentication
// If needed, a separate authenticated manifest could be generated for internal use

import { PROD_GEOSERVER_URL } from '../src/lib/constants';

interface LayerConfig {
  type: string;
  title?: string;
  url?: string;
  layers?: LayerConfig[];
  sublayers?: Array<{
    name?: string;
    queryable?: boolean;
  }>;
}

interface ExportManifestEntry {
  app: string;
  title: string;
  layerName: string;      // Full layer name (workspace:layer)
  wfsUrl: string;         // WFS endpoint URL
  bucketPath: string;     // Where to store in GCS
}

/**
 * Recursively extract exportable WMS layers from a layer config
 */
function extractExportableLayers(
  config: LayerConfig | LayerConfig[],
  app: string,
  wfsBaseUrl: string
): ExportManifestEntry[] {
  const entries: ExportManifestEntry[] = [];

  const configs = Array.isArray(config) ? config : [config];

  for (const layer of configs) {
    // Handle group layers - recurse into children
    if (layer.type === 'group' && layer.layers) {
      entries.push(...extractExportableLayers(layer.layers, app, wfsBaseUrl));
      continue;
    }

    // Handle WMS layers
    if (layer.type === 'wms' && layer.sublayers && layer.sublayers.length > 0) {
      const sublayer = layer.sublayers[0];

      // Skip if no layer name or not queryable (queryable=false means no WFS)
      if (!sublayer.name) continue;
      if (sublayer.queryable === false) continue;

      const title = layer.title || sublayer.name;
      const layerName = sublayer.name;

      // Generate safe bucket path from title
      const safeName = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      entries.push({
        app,
        title,
        layerName,
        wfsUrl: wfsBaseUrl,
        bucketPath: `${app}/${safeName}.geojson`,
      });
    }
  }

  return entries;
}

interface AppConfig {
  layers: LayerConfig[];
  requiresAuth: boolean;
}

// Map of app name to layer configs
const appConfigs: Record<string, AppConfig> = {
  'hazards': { layers: hazardsLayers as LayerConfig[], requiresAuth: false },
  'carbonstorage': { layers: carbonstorageLayers as LayerConfig[], requiresAuth: false },
  'minerals': { layers: mineralsLayers as LayerConfig[], requiresAuth: false },
  'wetlands': { layers: wetlandsLayers as LayerConfig[], requiresAuth: false },
  'wetlandplants': { layers: wetlandplantsLayers as LayerConfig[], requiresAuth: false },
  'geophysics': { layers: geophysicsLayers as LayerConfig[], requiresAuth: false },
  // hazards-review is intentionally excluded - protected route
};

// Generate the manifest
const wfsUrl = PROD_GEOSERVER_URL.replace(/\/?$/, '/wfs');
const manifest: ExportManifestEntry[] = [];

for (const [app, config] of Object.entries(appConfigs)) {
  // Skip protected apps from public manifest
  if (config.requiresAuth) {
    console.log(`  Skipping ${app} (requires auth)`);
    continue;
  }

  const entries = extractExportableLayers(config.layers, app, wfsUrl);
  manifest.push(...entries);
}

// Output manifest
const outputPath = path.join(__dirname, '../public/export-manifest.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log(`Generated export manifest with ${manifest.length} layers:`);
console.log(`  Output: ${outputPath}`);
console.log('');

// Summary by app
const byApp = manifest.reduce((acc, entry) => {
  acc[entry.app] = (acc[entry.app] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

for (const [app, count] of Object.entries(byApp)) {
  console.log(`  ${app}: ${count} layers`);
}
