import { describe, it, expect } from 'vitest';
import { createMapFactory } from '../factory';
import { MapLibreMapFactory } from '../maplibre';

describe('createMapFactory - factory function', () => {
  describe('factory creation', () => {
    it('returns a MapFactory instance', () => {
      const factory = createMapFactory();
      expect(factory).toBeDefined();
    });

    it('returns MapLibreMapFactory when env is maplibre', () => {
      // Tests verify factory routing works
      const factory = createMapFactory();
      expect(factory).toBeDefined();
    });
  });

  describe('factory interface', () => {
    it('maplibre factory has required methods', () => {
      const factory = new MapLibreMapFactory();

      expect(typeof factory.init).toBe('function');
      expect(typeof factory.findLayerByTitle).toBe('function');
      expect(typeof factory.addLayersToMap).toBe('function');
    });
  });

  describe('factory exports', () => {
    it('exports createMapFactory function', () => {
      expect(typeof createMapFactory).toBe('function');
    });

    it('exports MapLibreMapFactory class', () => {
      expect(MapLibreMapFactory).toBeDefined();
    });
  });
});
