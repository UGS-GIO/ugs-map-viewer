import { describe, it, expect } from 'vitest';
import { isWMSLayer, isGroupLayer } from '../utils';
import type { WMSLayerProps, GroupLayerProps, LayerProps } from '@/lib/types/mapping-types';

describe('isWMSLayer', () => {
  it('returns true for WMS layer', () => {
    const wmsLayer: LayerProps = {
      type: 'wms',
      url: 'https://example.com/wms',
      title: 'Test WMS Layer',
      visible: true,
      sublayers: []
    } as WMSLayerProps;

    expect(isWMSLayer(wmsLayer)).toBe(true);
  });

  it('returns false for group layer', () => {
    const groupLayer: LayerProps = {
      type: 'group',
      title: 'Test Group',
      visible: true,
      layers: []
    } as GroupLayerProps;

    expect(isWMSLayer(groupLayer)).toBe(false);
  });

  it('returns false for other layer types', () => {
    const otherLayer: LayerProps = {
      type: 'feature',
      title: 'Test Feature Layer',
      visible: true
    } as any;

    expect(isWMSLayer(otherLayer)).toBe(false);
  });
});

describe('isGroupLayer', () => {
  it('returns true for group layer', () => {
    const groupLayer: LayerProps = {
      type: 'group',
      title: 'Test Group',
      visible: true,
      layers: []
    } as GroupLayerProps;

    expect(isGroupLayer(groupLayer)).toBe(true);
  });

  it('returns false for WMS layer', () => {
    const wmsLayer: LayerProps = {
      type: 'wms',
      url: 'https://example.com/wms',
      title: 'Test WMS Layer',
      visible: true,
      sublayers: []
    } as WMSLayerProps;

    expect(isGroupLayer(wmsLayer)).toBe(false);
  });

  it('returns false for other layer types', () => {
    const otherLayer: LayerProps = {
      type: 'feature',
      title: 'Test Feature Layer',
      visible: true
    } as any;

    expect(isGroupLayer(otherLayer)).toBe(false);
  });
});
