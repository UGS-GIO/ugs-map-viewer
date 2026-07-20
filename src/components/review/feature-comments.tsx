/**
 * Per-feature review comments, gated on the layer having a DURABLE key.
 *
 * A feature comment is only meaningful if it can re-find the same feature after the data is reingested.
 * `feature_id` and (on some layers) `objectid` are positional — they renumber when rows are added or
 * removed — so anchoring to them would silently move a comment onto a different feature. Rather than do
 * that, layers without a durable key get an explicit "not available" note and keep layer-level comments.
 */
import type { GeoJsonProperties } from 'geojson';
import { ReviewComments } from './review-comments';

export const DEFAULT_STABLE_KEY = 'pk';

/** The durable key value for a clicked feature, or null when the layer has none. */
export function featureCommentTarget(
  properties: GeoJsonProperties | null | undefined,
  stableKey: string = DEFAULT_STABLE_KEY,
): { rowKey: string; rowVal: string } | null {
  const v = properties?.[stableKey];
  if (v == null || v === '') return null;
  return { rowKey: stableKey, rowVal: String(v) };
}

export function FeatureComments({ itemId, properties, stableKey = DEFAULT_STABLE_KEY, layerTitle }: {
  itemId: string;
  properties: GeoJsonProperties | null | undefined;
  stableKey?: string;
  layerTitle?: string;
}) {
  const target = featureCommentTarget(properties, stableKey);

  if (!target) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Feature comments unavailable</span> — this layer has
        no durable per-feature key (<code>{stableKey}</code>), so a comment couldn&apos;t reliably stay on
        this feature after the data is reprocessed. Use the layer-level Review Comments panel instead.
      </div>
    );
  }

  return (
    <ReviewComments
      itemId={itemId}
      target={target}
      label={`Comments on this feature${layerTitle ? ` — ${layerTitle}` : ''}`}
    />
  );
}
