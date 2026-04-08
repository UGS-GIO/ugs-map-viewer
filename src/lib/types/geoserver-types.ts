import { GeoJSON, FeatureCollection, Feature } from 'geojson';

export interface LegendProps {
    layerName: string;
    title: string;
    rules: LegendRule[];
}

export interface LegendRule {
    name: string;
    title: string;
    filter: string;
    symbolizers: Symbolizer[];
}

export interface Legend {
    Legend: LegendProps[];
}

export type LineCap = "butt" | "round" | "square";
export type LineJoin = "round" | "miter" | "bevel";

/**
 * GraphicMark represents the styling of individual graphic elements.
 */
export interface GraphicMark {
    mark?: string;
    fill?: string;
    'fill-opacity'?: string;
    stroke?: string;
    'stroke-width'?: string;
    'stroke-opacity'?: string;
    'stroke-linecap'?: LineCap;
    'stroke-linejoin'?: LineJoin;
}

/**
 * GraphicStrokeData represents the data structure for graphic strokes in symbolizers.
 */
export interface GraphicStrokeData {
    url?: string;
    size?: string;
    opacity?: string;
    rotation?: string;
    graphics?: GraphicMark[];
}

/**
 * GraphicFillData represents the data structure for graphic fills in symbolizers.
 */
export interface GraphicFillData {
    url?: string;
    size?: string;
    opacity?: string;
    rotation?: string;
    graphics?: GraphicMark[];
}

/**
 * Symbolizer represents the different types of symbolizers that can be applied to map features.
 * Each property is optional to allow for flexibility in symbolizer definitions.
 * - Line: Represents line symbolizers.
 * - Polygon: Represents polygon symbolizers.
 * - Point: Represents point symbolizers.
 */
export interface Symbolizer {
    Line?: StrokeSymbolizer;
    Polygon?: PolygonSymbolizer; // Changed to use the new intersection type
    Point?: PointSymbolizer;
    Raster?: RasterSymbolizer;
}

export interface RasterColormapEntry {
    label?: string;
    /** GeoServer serializes as a string. */
    quantity: string;
    color: string;
    /** "0.0" = NoData. */
    opacity?: string;
}

export interface RasterColormap {
    type?: 'ramp' | 'intervals' | 'values';
    entries: RasterColormapEntry[];
}

export interface RasterSymbolizer {
    colormap?: RasterColormap;
    opacity?: string;
}

/**
 * PointSymbolizer represents the styling of point features on the map.
 */
export interface PointSymbolizer {
    size: string;
    opacity: string;
    rotation: string;
    graphics: PointGraphic[];
    url?: string;
    title?: string;
    displacement?: Displacement;
}

/**
 * Displacement represents the x and y displacement for point symbolizers.
 */
interface Displacement {
    "displacement-x": string;
    "displacement-y": string;
}

/** 
 * PointGraphic represents the graphic properties of point features.
 */
interface PointGraphic {
    fill: string;
    "fill-opacity": string;
    mark: string;
    stroke: string;
    "stroke-linecap": LineCap;
    "stroke-linejoin": LineJoin;
    "stroke-opacity": string;
    "stroke-width": string;
    "external-graphic-url"?: string;
    "external-graphic-type"?: string;
}

/** 
 * StrokeSymbolizer represents the styling of line features on the map.
 */
export interface StrokeSymbolizer {
    "stroke"?: string;
    "stroke-width"?: string;
    "stroke-opacity"?: string;
    "stroke-linecap"?: LineCap;
    "stroke-linejoin"?: LineJoin;
    "stroke-dasharray"?: string[];
    "stroke-dashoffset"?: string;
    "perpendicular-offset"?: string;
    GraphicStroke?: GraphicStrokeData;
    'graphic-stroke'?: GraphicStrokeData;
}

/**
 * FillSymbolizer represents the styling of polygon features on the map.
 */
export interface FillSymbolizer {
    "fill"?: string; // Changed to optional
    "fill-opacity"?: string; // Changed to optional
    GraphicFill?: GraphicFillData;
    'graphic-fill'?: GraphicFillData;
}

/**
 * PolygonSymbolizer is an intersection type that combines both FillSymbolizer and StrokeSymbolizer.
 * This ensures that polygon symbolizers have properties for both fill and stroke styles.
 */
export type PolygonSymbolizer = FillSymbolizer & StrokeSymbolizer;

/**
 * GeoServer-specific CRS object that extends the standard GeoJSON format
 */
export interface GeoServerCRS {
    type: 'name';
    properties: {
        name: string;
    };
}

/**
 * Base interface for GeoServer extensions to GeoJSON objects
 */
export interface GeoServerExtensions {
    crs?: GeoServerCRS;
    totalFeatures?: number;
    numberMatched?: number;
    numberReturned?: number;
    timeStamp?: string;
}

/**
 * GeoServer's extended FeatureCollection (most common response type)
 */
export interface GeoServerFeatureCollection extends FeatureCollection, GeoServerExtensions {
    features: Feature[];
}

/**
 * Union type for any GeoServer GeoJSON response
 */
export type GeoServerGeoJSON =
    | (GeoJSON & GeoServerExtensions)
    | GeoServerFeatureCollection;