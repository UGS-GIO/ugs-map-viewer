import { Feature, Geometry, GeoJsonProperties } from 'geojson';

/**
 * Options for customizing highlight appearance
 */
export interface HighlightOptions {
  fillColor?: number[];
  outlineColor?: number[];
  outlineWidth?: number;
  pointSize?: number;
}

/**
 * Base interface for highlight providers
 * Both ArcGIS and MapLibre implementations must conform to this interface
 */
export interface HighlightProvider {
  /**
   * Highlight a feature on the map
   * @param feature - GeoJSON feature to highlight
   * @param sourceCRS - Source coordinate reference system
   * @param title - Title/identifier for the highlight
   * @param options - Optional styling options
   * @returns Promise resolving to success status
   */
  highlightFeature(
    feature: Feature<Geometry, GeoJsonProperties>,
    sourceCRS: string,
    title: string,
    options?: HighlightOptions
  ): Promise<boolean>;

  /**
   * Clear highlighted graphics from the map
   * @param title - Optional title to filter which graphics to remove
   */
  clearGraphics(title?: string): void;

  /**
   * Create a pin marker at specified coordinates
   * @param lat - Latitude
   * @param lon - Longitude
   */
  createPinGraphic(lat: number, lon: number): void;
}
