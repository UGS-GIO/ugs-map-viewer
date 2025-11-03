import { describe, it, expect } from 'vitest';
import { createHighlightProvider, ArcGISHighlight, MapLibreHighlight } from '../factory';

describe('createHighlightProvider - factory function', () => {
  describe('parameter validation', () => {
    it('throws error when view is missing for arcgis', () => {
      expect(() => {
        createHighlightProvider(undefined, undefined);
      }).toThrow();
    });

    it('creates provider when view is provided', () => {
      const mockView = {} as __esri.SceneView;
      const provider = createHighlightProvider(mockView, undefined);
      expect(provider).toBeDefined();
    });

  });

  describe('provider interface', () => {
    it('arcgis provider has required methods', () => {
      const mockView = {} as __esri.SceneView;
      const provider = new ArcGISHighlight(mockView);

      expect(typeof provider.highlightFeature).toBe('function');
      expect(typeof provider.clearGraphics).toBe('function');
      expect(typeof provider.createPinGraphic).toBe('function');
    });

    it('maplibre provider has required methods', () => {
      const mockMap = {} as any;
      const provider = new MapLibreHighlight(mockMap);

      expect(typeof provider.highlightFeature).toBe('function');
      expect(typeof provider.clearGraphics).toBe('function');
      expect(typeof provider.createPinGraphic).toBe('function');
    });
  });

  describe('factory exports', () => {
    it('exports createHighlightProvider function', () => {
      expect(typeof createHighlightProvider).toBe('function');
    });

    it('exports ArcGISHighlight class', () => {
      expect(ArcGISHighlight).toBeDefined();
    });

    it('exports MapLibreHighlight class', () => {
      expect(MapLibreHighlight).toBeDefined();
    });
  });
});
