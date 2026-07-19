/**
 * Auto-discovery of the review STAC catalog into map layers.
 *
 * The review app (served behind IAP at /review/app) fetches the review STAC catalog same-origin from
 * `/api/review-catalog` (review-serving crawls the `review/stac` prefix and returns the items). Every
 * mappable item becomes a PMTiles layer via the app's existing STAC resolver, and they're grouped under
 * a single auto-populated "Review" group — no hardcoded review layer list. Whatever ingest promotes into
 * the review catalog shows up automatically.
 *
 * (Generic version for arbitrary catalogs — the future `/stac` route pointed at ugs-serving-topics —
 * would traverse `catalog.json` -> child collections -> items client-side; here the server already
 * crawls, so we consume the flat item list.)
 */
import type { GroupLayerProps, LayerProps } from '@/lib/types/mapping-types';
import { resolveStacPMTilesLayer, type StacItem } from '@/lib/map/stac/stac-layer';
import { filterFieldsForItem } from '@/lib/map/layer-filters';

const REVIEW_CATALOG_URL = '/api/review-catalog';

/** Fetch the review STAC catalog items (same-origin behind IAP; the IAP cookie authenticates). */
export async function fetchReviewCatalog(): Promise<StacItem[]> {
  const res = await fetch(REVIEW_CATALOG_URL);
  if (!res.ok) throw new Error(`review-catalog ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.items) ? (data.items as StacItem[]) : [];
}

function itemTitle(item: StacItem): string {
  return (item.properties?.title as string | undefined) ?? item.id;
}

/** Build the auto-discovered "Review" group. Items without a PMTiles asset (not mappable) are skipped. */
// Displacement is special-cased: the InSAR filter/stats/legend panel is built per displacement TYPE, so
// the single displacement pmtiles item expands into 3 per-type layer entries (titles + renders match the
// DISPLACEMENT_LAYERS ': Review' registry, so isDisplacementLayerTitle + the panel reuse as-is). Each is
// the same pmtiles; the `type ==` base clause is applied via useDisplacementVectorFilters.
const DISPLACEMENT_ITEM_ID = 'hazards_displacement_contours';
const DISPLACEMENT_TYPE_LAYERS: Array<{ title: string; renderId: string }> = [
  { title: 'Displacement Contours - Cumulative: Review', renderId: 'cumulative' },
  { title: 'Displacement Contours - Yearly: Review', renderId: 'yearly' },
  { title: 'Displacement Contours - Vertical Displacement Rate: Review', renderId: 'velocity' },
];

export function reviewCatalogGroup(items: StacItem[]): GroupLayerProps | null {
  const layers: LayerProps[] = [];
  for (const item of items) {
    try {
      const base = resolveStacPMTilesLayer(item, { stacItemId: item.id, title: itemTitle(item), visible: false });
      if (item.id === DISPLACEMENT_ITEM_ID) {
        // Expand into 3 per-type layers (same pmtiles); each defaults to its own render.
        for (const { title, renderId } of DISPLACEMENT_TYPE_LAYERS) {
          layers.push({ ...base, title, defaultRenderId: base.renders?.some((r) => r.id === renderId) ? renderId : base.defaultRenderId });
        }
      } else {
        const filterFields = filterFieldsForItem(item.id);
        if (filterFields) base.filterFields = filterFields;
        layers.push(base);
      }
    } catch {
      // no PMTiles asset on this item — not mappable, skip
    }
  }
  if (!layers.length) return null;
  return { type: 'group', title: 'Review', visible: false, layers };
}

/** Fetch + build the review group, or null if unreachable/empty (e.g. outside IAP). */
export async function fetchReviewCatalogGroup(): Promise<GroupLayerProps | null> {
  try {
    return reviewCatalogGroup(await fetchReviewCatalog());
  } catch {
    return null;
  }
}

/** The review displacement item's geoparquet asset URL (signed, same-origin) — for duckdb-wasm stats. */
export async function fetchReviewDisplacementParquetUrl(): Promise<string | null> {
  const items = await fetchReviewCatalog();
  const item = items.find((i) => i.id === DISPLACEMENT_ITEM_ID);
  if (!item) return null;
  const assets = item.assets ?? {};
  const href = assets.data?.href ?? Object.values(assets).find((a) => a?.href?.includes('.parquet'))?.href;
  return href ?? null;
}
