import maplibregl, { LayerSpecification } from 'maplibre-gl';
import { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { convertGeometryToWGS84 } from '@/lib/map/conversion-utils';
import { HighlightProvider, HighlightOptions } from './types';

/**
 * MapLibre-specific highlight provider
 * Uses GeoJSON sources and layers for highlighting
 */
export class MapLibreHighlight implements HighlightProvider {
  private highlightSources: Set<string> = new Set();
  private sourceToTitle: Map<string, string> = new Map();
  private sourceCounter: number = 0;

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

    // Use counter to ensure unique source IDs even when Date.now() is the same
    const sourceId = `highlight-${title}-${Date.now()}-${this.sourceCounter++}`;
    const layerId = `highlight-layer-${sourceId}`;
    const outlineLayerId = `highlight-outline-${sourceId}`;

    this.map.addSource(sourceId, {
      type: 'geojson',
      data: geoJsonFeature
    });

    this.highlightSources.add(sourceId);
    this.sourceToTitle.set(sourceId, title);

    const geometryType = wgs84Geometry.type;

    if (geometryType === 'Point' || geometryType === 'MultiPoint') {
      const outlineLayer: LayerSpecification = {
        id: outlineLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': finalOptions.pointSize + 2,
          'circle-color': `rgba(0, 0, 0, 0.5)`,
          'circle-stroke-width': finalOptions.outlineWidth / 2,
          'circle-stroke-color': `rgba(0, 0, 0, 0.5)`
        }
      };

      const mainLayer: LayerSpecification = {
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': finalOptions.pointSize,
          'circle-color': `rgba(${finalOptions.fillColor.join(',')})`,
          'circle-stroke-width': finalOptions.outlineWidth > 0 ? 2 : 0,
          'circle-stroke-color': `rgba(${finalOptions.outlineColor.join(',')})`
        }
      };

      this.map.addLayer(outlineLayer);
      this.map.addLayer(mainLayer);
    }

    if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
      const outlineLayer: LayerSpecification = {
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': `rgba(0, 0, 0, 0.5)`,
          'line-width': finalOptions.outlineWidth + 2
        }
      };

      const mainLayer: LayerSpecification = {
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': `rgba(${finalOptions.outlineColor.join(',')})`,
          'line-width': finalOptions.outlineWidth
        }
      };

      this.map.addLayer(outlineLayer);
      this.map.addLayer(mainLayer);
    }

    if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
      const outlineLayer: LayerSpecification = {
        id: outlineLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': 'rgba(0, 0, 0, 0)',
          'fill-outline-color': 'rgba(0, 0, 0, 1)'
        }
      };

      const outlineStrokeLayer: LayerSpecification = {
        id: `${outlineLayerId}-stroke`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': 'rgba(0, 0, 0, 1)',
          'line-width': finalOptions.outlineWidth + 2
        }
      };

      const mainLayer: LayerSpecification = {
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': `rgba(${finalOptions.fillColor.join(',')})`,
          'fill-outline-color': `rgba(${finalOptions.outlineColor.join(',')})`
        }
      };

      const mainStrokeLayer: LayerSpecification = {
        id: `${layerId}-stroke`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': `rgba(${finalOptions.outlineColor.join(',')})`,
          'line-width': finalOptions.outlineWidth
        }
      };

      this.map.addLayer(outlineLayer);
      this.map.addLayer(outlineStrokeLayer);
      this.map.addLayer(mainLayer);
      this.map.addLayer(mainStrokeLayer);
    }

    return true;
  }

  clearGraphics(title?: string): void {
    const sourcesToRemove = [];

    for (const sourceId of this.highlightSources) {
      if (title) {
        const sourceTitle = this.sourceToTitle.get(sourceId);
        if (sourceTitle === title) {
          sourcesToRemove.push(sourceId);
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
      this.sourceToTitle.delete(sourceId);
    }
  }

  /**
   * Highlight multiple features in a single source/layer (much faster than individual calls)
   */
  highlightFeatureCollection(
    features: Feature<Geometry, GeoJsonProperties>[],
    sourceCRS: string,
    title: string,
    options?: HighlightOptions
  ): boolean {
    if (!features?.length || !this.map) {
      return false;
    }

    const defaultHighlightOptions: Required<HighlightOptions> = {
      fillColor: [0, 0, 0, 0],
      outlineColor: [255, 255, 0, 1],
      outlineWidth: 4,
      pointSize: 12
    };
    const finalOptions = { ...defaultHighlightOptions, ...options };

    // Convert all geometries to WGS84 and group by type
    const points: Feature[] = [];
    const lines: Feature[] = [];
    const polygons: Feature[] = [];

    for (const feature of features) {
      if (!feature.geometry) continue;
      const wgs84Geometry = convertGeometryToWGS84(feature.geometry, sourceCRS);
      if (!wgs84Geometry) continue;

      const geoJsonFeature: Feature = {
        type: 'Feature',
        geometry: wgs84Geometry,
        properties: { title }
      };

      const type = wgs84Geometry.type;
      if (type === 'Point' || type === 'MultiPoint') {
        points.push(geoJsonFeature);
      } else if (type === 'LineString' || type === 'MultiLineString') {
        lines.push(geoJsonFeature);
      } else if (type === 'Polygon' || type === 'MultiPolygon') {
        polygons.push(geoJsonFeature);
      }
    }

    const timestamp = Date.now();

    // Add lines (most common for faults)
    if (lines.length > 0) {
      const sourceId = `highlight-lines-${title}-${timestamp}`;
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: lines }
      });
      this.highlightSources.add(sourceId);
      this.sourceToTitle.set(sourceId, title);

      this.map.addLayer({
        id: `${sourceId}-outline`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': 'rgba(0, 0, 0, 0.5)',
          'line-width': finalOptions.outlineWidth + 2
        }
      });
      this.map.addLayer({
        id: `${sourceId}-main`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': `rgba(${finalOptions.outlineColor.join(',')})`,
          'line-width': finalOptions.outlineWidth
        }
      });
    }

    // Add points
    if (points.length > 0) {
      const sourceId = `highlight-points-${title}-${timestamp}`;
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: points }
      });
      this.highlightSources.add(sourceId);
      this.sourceToTitle.set(sourceId, title);

      this.map.addLayer({
        id: `${sourceId}-outline`,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': finalOptions.pointSize + 2,
          'circle-color': 'rgba(0, 0, 0, 0.5)'
        }
      });
      this.map.addLayer({
        id: `${sourceId}-main`,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': finalOptions.pointSize,
          'circle-color': `rgba(${finalOptions.fillColor.join(',')})`,
          'circle-stroke-width': 2,
          'circle-stroke-color': `rgba(${finalOptions.outlineColor.join(',')})`
        }
      });
    }

    // Add polygons
    if (polygons.length > 0) {
      const sourceId = `highlight-polygons-${title}-${timestamp}`;
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: polygons }
      });
      this.highlightSources.add(sourceId);
      this.sourceToTitle.set(sourceId, title);

      this.map.addLayer({
        id: `${sourceId}-fill`,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': `rgba(${finalOptions.fillColor.join(',')})`,
          'fill-outline-color': `rgba(${finalOptions.outlineColor.join(',')})`
        }
      });
      this.map.addLayer({
        id: `${sourceId}-stroke`,
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

    const pinLayer: LayerSpecification = {
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 10,
        'circle-color': '#ff0000',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    };

    this.map.addLayer(pinLayer);
  }
}
