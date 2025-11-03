import maplibregl from 'maplibre-gl';
import { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { convertGeometryToWGS84 } from '@/lib/map/conversion-utils';
import { HighlightProvider, HighlightOptions } from './types';

/**
 * MapLibre-specific highlight provider
 * Uses GeoJSON sources and layers for highlighting
 */
export class MapLibreHighlight implements HighlightProvider {
  private highlightSources: Set<string> = new Set();

  constructor(private map: maplibregl.Map) {}

  async highlightFeature(
    feature: Feature<Geometry, GeoJsonProperties>,
    sourceCRS: string,
    title: string,
    options?: HighlightOptions
  ): Promise<boolean> {
    if (!feature || !feature.geometry || !this.map) {
      console.warn('invalid feature or map provided for highlighting.');
      return false;
    }

    const wgs84Geometry = convertGeometryToWGS84(feature.geometry, sourceCRS);
    if (!wgs84Geometry) return false;

    const geoJsonFeature: Feature = {
      type: 'Feature',
      geometry: wgs84Geometry,
      properties: { title }
    };

    const defaultHighlightOptions: Required<HighlightOptions> = {
      fillColor: [0, 0, 0, 0],
      outlineColor: [255, 255, 0, 1],
      outlineWidth: 4,
      pointSize: 12
    };
    const finalOptions = { ...defaultHighlightOptions, ...options };

    const sourceId = `highlight-${title}-${Date.now()}`;
    const layerId = `highlight-layer-${sourceId}`;
    const outlineLayerId = `highlight-outline-${sourceId}`;

    this.map.addSource(sourceId, {
      type: 'geojson',
      data: geoJsonFeature
    });

    this.highlightSources.add(sourceId);

    const geometryType = wgs84Geometry.type;

    if (geometryType === 'Point') {
      this.map.addLayer({
        id: outlineLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': finalOptions.pointSize + 2,
          'circle-color': `rgba(0, 0, 0, 0.5)`,
          'circle-stroke-width': finalOptions.outlineWidth / 2,
          'circle-stroke-color': `rgba(0, 0, 0, 0.5)`
        }
      });

      this.map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': finalOptions.pointSize,
          'circle-color': `rgba(${finalOptions.fillColor.join(',')})`,
          'circle-stroke-width': finalOptions.outlineWidth > 0 ? 2 : 0,
          'circle-stroke-color': `rgba(${finalOptions.outlineColor.join(',')})`
        }
      });
    }

    if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
      this.map.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': `rgba(0, 0, 0, 0.5)`,
          'line-width': finalOptions.outlineWidth + 2
        }
      });

      this.map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': `rgba(${finalOptions.outlineColor.join(',')})`,
          'line-width': finalOptions.outlineWidth
        }
      });
    }

    if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
      this.map.addLayer({
        id: outlineLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': 'rgba(0, 0, 0, 0)',
          'fill-outline-color': 'rgba(0, 0, 0, 1)'
        }
      });

      this.map.addLayer({
        id: `${outlineLayerId}-stroke`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': 'rgba(0, 0, 0, 1)',
          'line-width': finalOptions.outlineWidth + 2
        }
      });

      this.map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': `rgba(${finalOptions.fillColor.join(',')})`,
          'fill-outline-color': `rgba(${finalOptions.outlineColor.join(',')})`
        }
      });

      this.map.addLayer({
        id: `${layerId}-stroke`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': `rgba(${finalOptions.outlineColor.join(',')})`,
          'line-width': finalOptions.outlineWidth
        }
      });
    }

    return true;
  }

  clearGraphics(title?: string): void {
    const sourcesToRemove = [];

    for (const sourceId of this.highlightSources) {
      if (title) {
        const source = this.map.getSource(sourceId);
        if (source && source.type === 'geojson') {
          const data = (source as any)._data;
          if (data && data.properties && data.properties.title === title) {
            sourcesToRemove.push(sourceId);
          }
        }
      } else {
        sourcesToRemove.push(sourceId);
      }
    }

    for (const sourceId of sourcesToRemove) {
      const layers = this.map.getStyle()?.layers || [];
      for (const layer of layers) {
        if ('source' in layer && layer.source === sourceId) {
          this.map.removeLayer(layer.id);
        }
      }

      if (this.map.getSource(sourceId)) {
        this.map.removeSource(sourceId);
      }

      this.highlightSources.delete(sourceId);
    }
  }

  createPinGraphic(lat: number, lon: number): void {
    const sourceId = `pin-${Date.now()}`;
    const layerId = `pin-layer-${sourceId}`;

    const geoJsonFeature: Feature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: {}
    };

    this.map.addSource(sourceId, {
      type: 'geojson',
      data: geoJsonFeature
    });

    this.highlightSources.add(sourceId);

    this.map.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 10,
        'circle-color': '#ff0000',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
  }
}
