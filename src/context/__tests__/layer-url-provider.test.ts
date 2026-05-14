import { describe, it, expect } from 'vitest';
import { hasActiveChildren, getDefaultGroupVisibility } from '../layer-url-provider';
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
