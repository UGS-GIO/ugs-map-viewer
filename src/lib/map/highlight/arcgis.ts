import { Feature, Geometry, GeoJsonProperties } from 'geojson';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import PictureMarkerSymbol from '@arcgis/core/symbols/PictureMarkerSymbol';
import { MAP_PIN_ICON } from '@/assets/icons';
import { convertGeometryToWGS84 } from '@/lib/map/conversion-utils';
import { HighlightProvider, HighlightOptions } from './types';

/**
 * ArcGIS-specific highlight provider
 * Uses ArcGIS Graphics collection for highlighting
 */
export class ArcGISHighlight implements HighlightProvider {
  constructor(private view: __esri.MapView | __esri.SceneView) {}

  async highlightFeature(
    feature: Feature<Geometry, GeoJsonProperties>,
    sourceCRS: string,
    title: string,
    options?: HighlightOptions
  ): Promise<boolean> {
    if (!feature || !feature.geometry || !this.view) {
      console.warn('invalid feature or view provided for highlighting.');
      return false;
    }

    const wgs84Geometry = convertGeometryToWGS84(feature.geometry, sourceCRS);
    if (!wgs84Geometry) return false;

    const wgs84SpatialReference = new SpatialReference({ wkid: 4326 });
    const esriGeom = this.createEsriGeometry(wgs84Geometry, wgs84SpatialReference);
    if (!esriGeom) return false;

    const defaultHighlightOptions: Required<HighlightOptions> = {
      fillColor: [0, 0, 0, 0],
      outlineColor: [255, 255, 0, 1],
      outlineWidth: 4,
      pointSize: 12
    };
    const finalOptions = { ...defaultHighlightOptions, ...options };
    const graphics = this.createEsriGraphics(esriGeom, finalOptions, title);

    if (!graphics || graphics.length === 0) return false;

    this.view.graphics.addMany(graphics);
    return true;
  }

  clearGraphics(title?: string): void {
    if (title) {
      const graphicsToRemove = this.view.graphics.filter(graphic => graphic.attributes?.title === title);
      this.view.graphics.removeMany(graphicsToRemove);
    } else {
      this.view.graphics.removeAll();
    }
  }

  createPinGraphic(lat: number, lon: number): void {
    const markerSymbol = new PictureMarkerSymbol({
      url: `${MAP_PIN_ICON}`,
      width: "20px",
      height: "20px",
      yoffset: 10
    });
    const pointGraphic = new Graphic({
      geometry: new Point({ longitude: lon, latitude: lat }),
      symbol: markerSymbol
    });
    this.view.graphics.add(pointGraphic);
  }

  private createEsriGeometry(
    geoJsonGeometry: Geometry,
    spatialReference: SpatialReference
  ): __esri.Geometry | null {
    if (!geoJsonGeometry) return null;
    try {
      if (geoJsonGeometry.type === 'Point') {
        return new Point({
          x: geoJsonGeometry.coordinates[0],
          y: geoJsonGeometry.coordinates[1],
          spatialReference: spatialReference,
        });
      }

      if (geoJsonGeometry.type === 'LineString') {
        return new Polyline({
          paths: [geoJsonGeometry.coordinates],
          spatialReference: spatialReference,
        });
      }

      if (geoJsonGeometry.type === 'Polygon') {
        return new Polygon({
          rings: geoJsonGeometry.coordinates,
          spatialReference: spatialReference,
        });
      }

      if (geoJsonGeometry.type === 'MultiPolygon') {
        return new Polygon({
          rings: geoJsonGeometry.coordinates.flat(1) as number[][][],
          spatialReference: spatialReference,
        });
      }

      if (geoJsonGeometry.type === 'MultiLineString') {
        return new Polyline({
          paths: geoJsonGeometry.coordinates,
          spatialReference: spatialReference,
        });
      }

      console.warn(`createEsriGeometry: unsupported geojson geometry type for esri conversion: ${geoJsonGeometry.type}`);
      return null;
    } catch (error) {
      console.error("createEsriGeometry: error converting geojson to esri geometry:", error);
      return null;
    }
  }

  private createEsriGraphics(
    esriGeometry: __esri.Geometry,
    options: Required<HighlightOptions>,
    title: string
  ): Graphic[] {
    if (!esriGeometry) return [];
    try {
      if (esriGeometry.type === 'point' || esriGeometry.type === 'multipoint') {
        const pointSymbol = new SimpleMarkerSymbol({
          color: options.fillColor,
          size: options.pointSize,
          outline: { color: options.outlineColor, width: options.outlineWidth > 0 ? 2 : 0 }
        });
        const outlineSymbol = new SimpleMarkerSymbol({
          color: options.fillColor,
          size: options.pointSize + 2,
          outline: { color: [0, 0, 0, .5], width: options.outlineWidth / 2 }
        });
        const attributes = { title: title };
        return [
          new Graphic({ geometry: esriGeometry, symbol: pointSymbol, attributes }),
          new Graphic({ geometry: esriGeometry, symbol: outlineSymbol, attributes })
        ];
      }

      if (esriGeometry.type === 'polyline') {
        const lineSymbol = new SimpleLineSymbol({ color: options.outlineColor, width: options.outlineWidth });
        const outlineSymbol = new SimpleLineSymbol({
          color: [0, 0, 0, .5],
          width: options.outlineWidth + 2
        });
        const attributes = { title: title };
        return [
          new Graphic({ geometry: esriGeometry, symbol: outlineSymbol, attributes }),
          new Graphic({ geometry: esriGeometry, symbol: lineSymbol, attributes })
        ];
      }

      if (esriGeometry.type === 'polygon') {
        const fillSymbol = new SimpleFillSymbol({
          color: options.fillColor,
          outline: { color: options.outlineColor, width: options.outlineWidth }
        });
        const outlineSymbol = new SimpleFillSymbol({
          color: [0, 0, 0, 0],
          outline: { color: [0, 0, 0, 1], width: options.outlineWidth + 2 }
        });
        const attributes = { title: title };
        return [
          new Graphic({ geometry: esriGeometry, symbol: outlineSymbol, attributes }),
          new Graphic({ geometry: esriGeometry, symbol: fillSymbol, attributes })
        ];
      }

      console.warn(`createEsriGraphics: unsupported esri geometry type for default symbol generation: ${esriGeometry.type}`);
      return [];
    } catch (error) {
      console.error("createEsriGraphics: error creating esri symbol or graphic:", error);
      return [];
    }
  }
}
