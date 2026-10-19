import { describe, it, expect } from 'vitest';
import { hasActiveChildren, getDefaultGroupVisibility, enforceVariantExclusivity, computeExclusiveSelection } from '../layer-url-provider';
import type { LayerProps, GroupLayerProps } from '@/lib/types/mapping-types';

const wmsLayer = (title: string, visible = false): LayerProps => ({
  type: 'wms',
  title,
  visible,
  sublayers: [],
});

const group = (
  title: string,
  layers: LayerProps[],
  visible: boolean | undefined = undefined,
): GroupLayerProps => ({
  type: 'group',
  title,
  visible,
  layers,
});

const variantGroup = (title: string, layers: LayerProps[]): GroupLayerProps => ({
  type: 'group',
  title,
  variantSelector: true,
  layers,
});

describe('hasActiveChildren', () => {
  it('returns true when a child is visible by config default', () => {
    const layers = [wmsLayer('A', true), wmsLayer('B')];
    expect(hasActiveChildren(layers, new Set())).toBe(true);
  });

  it('returns false when no children are visible or selected', () => {
    const layers = [wmsLayer('A'), wmsLayer('B')];
    expect(hasActiveChildren(layers, new Set())).toBe(false);
  });

  it('returns true when a child is URL-selected but not config-visible', () => {
    const layers = [wmsLayer('A'), wmsLayer('B')];
    expect(hasActiveChildren(layers, new Set(['B']))).toBe(true);
  });

  it('recurses into nested groups', () => {
    const nested = group('Inner', [wmsLayer('Deep')]);
    const layers = [nested];
    expect(hasActiveChildren(layers, new Set(['Deep']))).toBe(true);
    expect(hasActiveChildren(layers, new Set())).toBe(false);
  });
});

describe('getDefaultGroupVisibility', () => {
  // Implicit (no group.visible set) → falls back to hasActiveChildren
  it('derives from children when group.visible is undefined and a child is config-default visible', () => {
    const layers = [group('G1', [wmsLayer('A', true), wmsLayer('B')])];
    const result = getDefaultGroupVisibility(layers, new Set());
    expect(result.get('G1')).toBe(true);
  });

  it('derives hidden when group.visible is undefined and no children are active', () => {
    const layers = [group('G1', [wmsLayer('A'), wmsLayer('B')])];
    const result = getDefaultGroupVisibility(layers, new Set());
    expect(result.get('G1')).toBe(false);
  });

  it('derives visible when child is URL-selected and group.visible is undefined', () => {
    const layers = [group('G1', [wmsLayer('A'), wmsLayer('B')])];
    const result = getDefaultGroupVisibility(layers, new Set(['A']));
    expect(result.get('G1')).toBe(true);
  });

  // Explicit group.visible wins over derived state
  it('honors explicit group.visible: false even when children are selected', () => {
    const layers = [group('G1', [wmsLayer('A', true)], false)];
    const result = getDefaultGroupVisibility(layers, new Set(['A']));
    expect(result.get('G1')).toBe(false);
  });

  it('honors explicit group.visible: true even when no children are active', () => {
    const layers = [group('G1', [wmsLayer('A')], true)];
    const result = getDefaultGroupVisibility(layers, new Set());
    expect(result.get('G1')).toBe(true);
  });

  it('handles nested groups', () => {
    const inner = group('Inner', [wmsLayer('Deep')]);
    const outer = group('Outer', [inner]);
    const result = getDefaultGroupVisibility([outer], new Set(['Deep']));
    expect(result.get('Inner')).toBe(true);
    expect(result.get('Outer')).toBe(true);
  });

  it('skips non-group layers', () => {
    const layers = [wmsLayer('A', true)];
    const result = getDefaultGroupVisibility(layers, new Set());
    expect(result.size).toBe(0);
  });
});

describe('enforceVariantExclusivity', () => {
  it('leaves a single selected surface unchanged', () => {
    const cfg = [variantGroup('Disp', [wmsLayer('Cumulative', true), wmsLayer('Yearly'), wmsLayer('Rate')])];
    expect(enforceVariantExclusivity(cfg, ['Cumulative'])).toEqual(['Cumulative']);
  });

  it('keeps the config-default (visible) surface when several are selected', () => {
    const cfg = [variantGroup('Disp', [wmsLayer('Cumulative', true), wmsLayer('Yearly'), wmsLayer('Rate')])];
    expect(enforceVariantExclusivity(cfg, ['Yearly', 'Cumulative', 'Rate'])).toEqual(['Cumulative']);
  });

  it('keeps the first selected surface (child order) when none is config-default visible', () => {
    const cfg = [variantGroup('Disp', [wmsLayer('Cumulative'), wmsLayer('Yearly'), wmsLayer('Rate')])];
    expect(enforceVariantExclusivity(cfg, ['Rate', 'Yearly'])).toEqual(['Yearly']);
  });

  it('preserves selections outside the variant group', () => {
    const cfg = [
      variantGroup('Disp', [wmsLayer('Cumulative', true), wmsLayer('Yearly')]),
      wmsLayer('Aquifer', true),
    ];
    expect([...enforceVariantExclusivity(cfg, ['Aquifer', 'Cumulative', 'Yearly'])].sort())
      .toEqual(['Aquifer', 'Cumulative']);
  });

  it('does not dedupe a normal (non-variant) group', () => {
    const cfg = [group('Normal', [wmsLayer('A', true), wmsLayer('B')])];
    expect(enforceVariantExclusivity(cfg, ['A', 'B'])).toEqual(['A', 'B']);
  });

  it('returns the same array reference when nothing is dropped', () => {
    const cfg = [variantGroup('Disp', [wmsLayer('Cumulative', true), wmsLayer('Yearly')])];
    const sel = ['Cumulative'];
    expect(enforceVariantExclusivity(cfg, sel)).toBe(sel);
  });
});

describe('computeExclusiveSelection', () => {
  it('selects the target, deselects siblings, and drops their filters', () => {
    const res = computeExclusiveSelection(
      { selected: ['Cumulative', 'Yearly'], filters: { Yearly: 'x=1', Other: 'y=2' }, visibility: {} },
      'Rate', ['Cumulative', 'Yearly', 'Rate'], [],
    );
    expect(res).not.toBeNull();
    expect(new Set(res!.selected)).toEqual(new Set(['Rate']));
    expect(res!.filters).toEqual({ Other: 'y=2' });
  });

  it('reveals ancestor groups', () => {
    const res = computeExclusiveSelection(
      { selected: [], filters: {}, visibility: { 'Land Subsidence': false } },
      'Cumulative', ['Cumulative', 'Yearly'], ['Land Subsidence', 'Displacement (InSAR)'],
    );
    expect(res!.visibility).toEqual({ 'Land Subsidence': true, 'Displacement (InSAR)': true });
    expect(res!.selected).toContain('Cumulative');
  });

  it('preserves unrelated selections', () => {
    const res = computeExclusiveSelection(
      { selected: ['Aquifer', 'Cumulative'], filters: {}, visibility: {} },
      'Yearly', ['Cumulative', 'Yearly'], [],
    );
    expect(new Set(res!.selected)).toEqual(new Set(['Aquifer', 'Yearly']));
  });

  it('returns null when the target is already the sole selection (idempotent no-op)', () => {
    const res = computeExclusiveSelection(
      { selected: ['Cumulative'], filters: {}, visibility: {} },
      'Cumulative', ['Cumulative', 'Yearly', 'Rate'], [],
    );
    expect(res).toBeNull();
  });
});
