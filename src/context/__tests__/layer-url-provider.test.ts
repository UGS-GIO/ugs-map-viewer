import { describe, it, expect } from 'vitest';
import { hasActiveChildren, getDefaultGroupVisibility } from '../layer-url-provider';
import type { LayerProps, GroupLayerProps } from '@/lib/types/mapping-types';

const wmsLayer = (title: string, visible = false): LayerProps => ({
  type: 'wms',
  title,
  visible,
  sublayers: [],
});

const group = (title: string, layers: LayerProps[]): GroupLayerProps => ({
  type: 'group',
  title,
  visible: true,
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
  it('sets group visible when child is config-default visible', () => {
    const layers = [group('G1', [wmsLayer('A', true), wmsLayer('B')])];
    const result = getDefaultGroupVisibility(layers, new Set());
    expect(result.get('G1')).toBe(true);
  });

  it('sets group hidden when no children are active', () => {
    const layers = [group('G1', [wmsLayer('A'), wmsLayer('B')])];
    const result = getDefaultGroupVisibility(layers, new Set());
    expect(result.get('G1')).toBe(false);
  });

  it('sets group visible when child is URL-selected', () => {
    const layers = [group('G1', [wmsLayer('A'), wmsLayer('B')])];
    const result = getDefaultGroupVisibility(layers, new Set(['A']));
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
