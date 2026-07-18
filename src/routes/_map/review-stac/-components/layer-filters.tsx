/**
 * Generic per-layer filter UI. Reads a layer's declarative `filterFields` and renders controls
 * (enum → toggle chips, number-range → min/max inputs), writing into ReviewFilterContext. Origin-
 * agnostic: give it any PMTilesLayerProps that carries filterFields.
 */
import { useMemo } from 'react';
import type { FilterSpecification } from 'maplibre-gl';
import type { PMTilesLayerProps, LayerProps } from '@/lib/types/mapping-types';
import { buildFilterExpression } from '@/lib/map/layer-filters';
import { isGroupLayer, isPMTilesLayer } from '@/lib/map/layer-utils';
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';
import { useReviewFilters } from './review-filter-context';

/** {layerTitle -> MapLibre filter} for the review-stac layers — feed to GenericMapContainer's
 *  vectorLayerFilters. Empty when nothing is constrained. */
export function useReviewVectorFilters(): Record<string, FilterSpecification> {
  const { values } = useReviewFilters();
  const layers = useGetLayerConfigsData('review-stac') ?? [];
  return useMemo(() => {
    const out: Record<string, FilterSpecification> = {};
    const walk = (ls: LayerProps[]) => {
      for (const l of ls) {
        if (isGroupLayer(l) && l.layers) walk(l.layers);
        else if (isPMTilesLayer(l) && l.filterFields?.length && l.title) {
          const expr = buildFilterExpression(l.filterFields, values[l.title] ?? {});
          if (expr) out[l.title] = expr;
        }
      }
    };
    walk(layers);
    return out;
  }, [values, layers]);
}

function EnumControl({ title, field, options }: { title: string; field: string; options: string[] }) {
  const { values, setFieldValue } = useReviewFilters();
  const selected = (values[title]?.[field] as string[] | undefined) ?? options; // default: all on
  const toggle = (v: string) => {
    const cur = (values[title]?.[field] as string[] | undefined) ?? options;
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    setFieldValue(title, field, next.length === options.length ? undefined : next);
  };
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((v) => {
        const on = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => toggle(v)}
            className={`rounded border px-1.5 py-0.5 text-[11px] ${on ? 'border-primary bg-primary/15 text-foreground' : 'text-muted-foreground'}`}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

function RangeControl({ title, field, min, max, step }: { title: string; field: string; min: number; max: number; step?: number }) {
  const { values, setFieldValue } = useReviewFilters();
  const [lo, hi] = (values[title]?.[field] as [number, number] | undefined) ?? [min, max];
  const update = (nlo: number, nhi: number) => {
    const clamped: [number, number] = [Math.max(min, Math.min(nlo, nhi)), Math.min(max, Math.max(nhi, nlo))];
    setFieldValue(title, field, clamped[0] === min && clamped[1] === max ? undefined : clamped);
  };
  return (
    <div className="flex items-center gap-1 text-[11px]">
      <input type="number" value={lo} min={min} max={max} step={step ?? 1}
        onChange={(e) => update(Number(e.target.value), hi)} className="w-16 rounded border px-1 py-0.5" />
      <span className="text-muted-foreground">–</span>
      <input type="number" value={hi} min={min} max={max} step={step ?? 1}
        onChange={(e) => update(lo, Number(e.target.value))} className="w-16 rounded border px-1 py-0.5" />
    </div>
  );
}

export function LayerFilters({ layer }: { layer: PMTilesLayerProps }) {
  if (!layer.filterFields?.length || !layer.title) return null;
  return (
    <div className="space-y-2 p-2">
      {layer.filterFields.map((spec) => (
        <div key={spec.field}>
          <div className="mb-1 text-xs font-medium">{spec.label}</div>
          {spec.kind === 'enum' ? (
            <EnumControl title={layer.title!} field={spec.field} options={spec.values} />
          ) : (
            <RangeControl title={layer.title!} field={spec.field} min={spec.min} max={spec.max} step={spec.step} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Find a pmtiles layer by title in a (possibly nested) config tree and render its filters. For the
 *  sidebar Filters slot, which only hands us a layer title. */
export function LayerFiltersByTitle({ title, config }: { title: string; config: LayerProps[] }) {
  const found = findPMTilesByTitle(config, title);
  if (!found) return null;
  return <LayerFilters layer={found} />;
}

function findPMTilesByTitle(layers: LayerProps[], title: string): PMTilesLayerProps | undefined {
  for (const l of layers) {
    if (isGroupLayer(l) && l.layers) {
      const r = findPMTilesByTitle(l.layers, title);
      if (r) return r;
    } else if (isPMTilesLayer(l) && l.title === title && l.filterFields?.length) {
      return l;
    }
  }
  return undefined;
}
