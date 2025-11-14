import { FeatureCollection, GeoJsonProperties } from "geojson"


/* eslint-disable @typescript-eslint/no-explicit-any */

export interface LinkDefinition {
    label: string;
    href: string | null;
}

export interface LinkConfig {
    baseUrl?: string;
    // Transform takes the field's value AND all properties, returns an array of links.
    transform?: (value: any, properties?: GeoJsonProperties) => LinkDefinition[];
}

export interface LinkFields {
    [fieldKey: string]: LinkConfig;
}

export type ColorCodingRecordFunction = Record<string, (value: string | number) => string>;
export interface RasterSource {
    url: string;
    layerName: string;   // Name of the layer in the WMS service including the workspace
    valueField: string;  // Field name for the raster value in the response
    valueLabel: string;  // Label to display for the raster value
    headers?: Record<string, string>;
    transform?: (value: number) => string;
}

export type RasterValueMetadata = Pick<RasterSource, 'valueField' | 'valueLabel' | 'transform'>;

export type ProcessedRasterSource = RasterSource & {
    data: FeatureCollection | null;
};

// Base configuration
interface BaseFieldConfig {
    label?: string;
    field: string;
    type: 'string' | 'number' | 'custom';
}

// String-specific field configuration
export interface StringPopupFieldConfig extends BaseFieldConfig {
    type: 'string';
    transform?: (value: string | null) => string | null;
}

// Number-specific field configuration
export interface NumberPopupFieldConfig extends BaseFieldConfig {
    type: 'number';
    decimalPlaces?: number;
    unit?: string;
    transform?: (value: number | null) => string | null;
}

// Custom-specific field configuration
export interface CustomPopupFieldConfig extends BaseFieldConfig {
    type: 'custom';
    transform?: (properties: GeoJsonProperties | any | null | undefined) => string;
}

// Your main FieldConfig is a discriminated union of these specific types
export type FieldConfig = StringPopupFieldConfig | NumberPopupFieldConfig | CustomPopupFieldConfig;

export type CustomSublayerProps = {
    popupFields?: Record<string, FieldConfig>; // Maps field labels to attribute names
    relatedTables?: RelatedTable[];
    linkFields?: LinkFields;
    colorCodingMap?: ColorCodingRecordFunction; // Maps field names to color coding functions
    rasterSource?: RasterSource;
    schema?: string; // postgreSQL schema name, used for the accept-profile header in postgrest requests because the schema name does not necessarilly match the workspace name in geoserver
};

export type ExtendedSublayerProperties = {
    name?: string;
    queryable?: boolean;
    popupEnabled?: boolean;
    visible?: boolean;
} & CustomSublayerProps;



interface BaseLayerProps {
    type: 'feature' | 'tile' | 'map-image' | 'geojson' | 'imagery' | 'wms' | 'group';
    title: string;
    url?: string;
    visible?: boolean;
    options?: any;
    opacity?: number;
}

export interface WMSLayerProps extends BaseLayerProps {
    type: 'wms';
    sublayers: ExtendedSublayerProperties[];
    customLayerParameters?: object | null | undefined;
    crs?: string; // EPSG code (e.g., 'EPSG:26912', 'EPSG:3857') for WMS GetFeatureInfo requests
}

export interface GroupLayerProps extends BaseLayerProps {
    type: 'group';
    layers?: LayerProps[];
}


export type LayerType = 'feature' | 'tile' | 'map-image' | 'imagery' | 'group' | 'geojson' | 'wms'

export type LayerProps = WMSLayerProps | GroupLayerProps | BaseLayerProps;

export type MapImageLayerRenderer = {
    type: 'map-image-renderer';
    label: string;
    imageData: string;
    id: string;
    url: string;
    title: string;
};

export type RegularLayerRenderer = {
    type: 'regular-layer-renderer';
    renderer: CompositeSymbolResult | HTMLElement | SVGSVGElement;
    id: string;
    label: string;
    url: string;
};

export type RendererProps = { MapImageLayerRenderer: MapImageLayerRenderer[], RegularLayerRenderer: RegularLayerRenderer[] }

type MapImageLayerLegendItem = {
    label: string;
    url: string;
    imageData: string;
    contentType: string;
    groupId: string;
    height: number;
    width: number;
    values?: string[];
};

type MapImageLayerLegendGroup = {
    id: string;
    heading: string;
};

type MapImageLayerLayer = {
    layerId: number;
    layerName: string;
    layerType: string;
    minScale: number;
    maxScale: number;
    legend: MapImageLayerLegendItem[];
    legendGroups: MapImageLayerLegendGroup[];
};

export type MapImageLayerType = {
    layers: MapImageLayerLayer[];
};

export type GetRenderer = (layerId: string, url: string | undefined) => Promise<RendererProps | undefined>;

export type UIPositionOptions = "bottom-leading" | "bottom-left" | "bottom-right" | "bottom-trailing" | "top-leading" | "top-left" | "top-right" | "top-trailing" | "manual"

export interface RelatedTable {
    fieldLabel: string;
    matchingField: string;
    targetField: string;
    url: string;
    headers: Record<string, string>;
    displayFields?: DisplayField[];
    logicalOperator?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
}


interface DisplayField {
    field: string;
    label?: string;
    transform?: (value: string) => React.ReactNode;
}

// Interface for composite symbol results
export interface CompositeSymbolResult {
    html?: HTMLElement;
    isComposite: boolean;
    symbolizers: { type: string; [key: string]: string | number | boolean }[];
}