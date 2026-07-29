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
    type: 'string' | 'number' | 'date' | 'custom';
    /** Tooltip text shown on hover over the field label */
    description?: string;
    /** Whether this field is sortable in the table. Defaults to true for string/number/date, false for custom. */
    sortable?: boolean;
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

// Date-specific field configuration
export interface DatePopupFieldConfig extends BaseFieldConfig {
    type: 'date';
    format?: 'iso' | 'short' | 'long';
}

// Custom-specific field configuration
export interface CustomPopupFieldConfig extends BaseFieldConfig {
    type: 'custom';
    transform?: (properties: GeoJsonProperties | null | undefined) => string;
}

// Your main FieldConfig is a discriminated union of these specific types
export type FieldConfig = StringPopupFieldConfig | NumberPopupFieldConfig | DatePopupFieldConfig | CustomPopupFieldConfig;

export type ColorCodingMode = 'text' | 'background';

export interface ImageFieldConfig {
    field: string;
    label?: string;
    baseUrl?: string;
}

export type CustomSublayerProps = {
    popupFields?: Record<string, FieldConfig>; // Maps field labels to attribute names
    popupFieldsTable?: PopupFieldsTableConfig[]; // Subsets of popupFields rendered as tables in collapsible dropdowns
    relatedTables?: RelatedTable[];
    relatedTablesPosition?: 'above' | 'below'; // Render related tables above or below the popup fields (default 'below')
    linkFields?: LinkFields;
    imageFields?: ImageFieldConfig[];
    colorCodingMap?: ColorCodingRecordFunction; // Maps field names to color coding functions
    colorCodingMode?: ColorCodingMode; // How to apply the color: 'text' (default) or 'background'
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
    type: 'feature' | 'tile' | 'map-image' | 'geojson' | 'imagery' | 'wms' | 'group' | 'pmtiles' | 'cog' | 'wfs';
    title: string;
    url?: string;
    visible?: boolean;
    options?: any;
    opacity?: number;
    maxZoomLevel?: number;
    customLegend?: React.ReactNode;
    /** Structured bivariate legend config — works in both sidebar and print export */
    bivariateLegend?: { xLabel: string; yLabel: string };
    /** GeoParquet URL for client-side export. When set, download button in layer controls is enabled. */
    downloadParquetUrl?: string;
    /** Zoom range [min, max] where this layer renders. Out-of-range → UI shows "Zoom in to see" hint. Auto-resolved from WMS GetCapabilities or PMTiles header if omitted. */
    visibleZoomRange?: [number, number];
}

export interface WMSLayerProps extends BaseLayerProps {
    type: 'wms';
    sublayers: ExtendedSublayerProperties[];
    customLayerParameters?: Record<string, string> | null;
    crs?: string; // EPSG code (e.g., 'EPSG:26912', 'EPSG:3857') for WMS GetFeatureInfo requests
    /** Set to enable min/max labels on the raster colorbar legend. Omit to render the bar without labels. */
    legendUnit?: string;
    /** GeoServer SLD style name. When set, both map tiles and the layer-list legend request this style instead of the layer's default. */
    styleName?: string;
}

export interface ArcGISMapServerLayerProps extends BaseLayerProps {
    type: 'map-image';
    /** Base ArcGIS MapServer URL (e.g., .../MapServer — no /export, no /0) */
    url: string;
}

export interface COGLayerProps extends BaseLayerProps {
    type: 'cog';
    /** HTTP(S) URL to the COG file. */
    cogUrl: string;
    /** Optional STAC item URL. Used as fallback if COG has no embedded stats (gdal_edit -stats). */
    stacUrl?: string;
    /** Dynamic stretch from COG-embedded stats (or STAC fallback). 'minmax' = [min, max]. 'sigma' = mean ± 2σ. */
    stretchMode?: 'minmax' | 'sigma';
    /** Viridis-like hex color stops, low → high. */
    colorStops: string[];
    /** Linear interpolation between stops; false = stepped. */
    continuous?: boolean;
    /** Reverse color order. */
    reverse?: boolean;
    /** Unit for legend labels (e.g. 'mGal'). */
    legendUnit?: string;
    /** Human-readable label for the sampled pixel value in popups (e.g. 'Gravity Anomaly'). */
    popupValueLabel?: string;
}

/**
 * One symbology option for a PMTiles layer, mirroring a STAC item's `renders`
 * entry (ugs-styles publishes these per `(itemId, render)`). The viewer fetches
 * `styleUrl` (a `{ layers: [...] }` fragment), loads `sprite` if present, and
 * derives the legend from `legend`. Multiple renders on one layer drive the
 * "Symbolize by" toggle via the `vector_symbology` search param (value = `id`).
 */
/** One legend entry: a symbology colour + what it represents. `values` (grouped renders) =
 *  the specific field values this entry rolls up, each with its own shade of the group colour;
 *  `stroke` = optional swatch outline (flat renders). Each grouped value's `value` is the raw
 *  data/filter token; `label` (optional) is its display text when the raw token isn't fit to show
 *  as-is (e.g. shouty-case managed codes) — falls back to `value` when absent. */
export interface LegendEntry {
    label: string;
    color: string;
    values?: readonly { value: string; color: string; label?: string }[];
    stroke?: string;
}

export interface PMTilesRender {
    /** Render id; also the `vector_symbology[title]` value that selects it. */
    id: string;
    /** Human-readable label for the symbology selector. */
    title?: string;
    /** URL to the render's MapLibre style fragment (`{ layers: [...] }`). */
    styleUrl: string;
    /** Optional sprite sheet base URL (no extension) for icon renders. */
    sprite?: string;
    /** Legend swatches; the source of truth for this render's symbology (colour + grouping). */
    legend?: LegendEntry[];
    /** Feature attribute this render symbolizes — lets the legend/filter wire to a field. */
    field?: string;
}

export interface PMTilesLayerProps extends BaseLayerProps {
    type: 'pmtiles';
    /**
     * STAC item id (warehouse serving-topics). When set, the config pipeline
     * resolves `pmtilesUrl`, `sourceLayer`, `renders`, and `downloadParquetUrl`
     * from the STAC item before render — the app config carries only UX
     * (title, sublayers/popups, visibility). See `resolveStacLayerTree`.
     */
    stacItemId?: string;
    /** URL to the PMTiles file (can be relative like '/pmtiles/layer.pmtiles' or absolute). Filled from STAC when `stacItemId` is set. */
    pmtilesUrl: string;
    /** URL to the style JSON file, or inline style layers */
    styleUrl?: string;
    /**
     * Multiple symbology renders (from STAC `item.renders`). When set, the layer
     * renders every render's layers (visibility-toggled by `vector_symbology`)
     * instead of the single `styleUrl`. The first entry, or `defaultRenderId`,
     * is shown initially.
     */
    renders?: PMTilesRender[];
    /** Which render id is active by default (defaults to `renders[0].id`). */
    defaultRenderId?: string;
    /** Source layer name within the PMTiles file */
    sourceLayer: string;
    /** Optional sublayer config for popups/queries */
    sublayers?: ExtendedSublayerProperties[];
    /**
     * Declarative, layer-level filter controls. Origin-agnostic: auto-discovered layers get these from
     * a registry (or STAC columns); a config-based layer can hand-declare them. Consumed by the generic
     * <LayerFilters> UI + buildFilterExpression -> vectorLayerFilters (MapLibre setFilter). See
     * src/lib/map/layer-filters.ts.
     */
    filterFields?: FilterFieldSpec[];
    /** Feature property holding a DURABLE per-feature key (default 'pk'). Feature-level review comments
     *  anchor to it; without one they stay disabled, since positional ids (feature_id/objectid) can
     *  re-number on reingest and would silently re-anchor a comment to a different feature. */
    stableKey?: string;
}

/** A single declarative filter control on a vector layer's feature property. */
export type FilterFieldSpec =
    | {
          field: string;
          label: string;
          kind: 'enum';
          values: string[];
          /** Single-select (one value at a time, radio-like) instead of the default multi-select chips. */
          single?: boolean;
          /** Picking a value also switches the layer's render (symbology). Requires `optionRenders`.
           *  Generic mechanism: any config layer can make an enum field drive symbology, not just displacement. */
          drivesSymbology?: boolean;
          /** value -> renderId, used when `drivesSymbology`. */
          optionRenders?: Record<string, string>;
          /** Default selected value for a `single` field (falls back to values[0]). */
          defaultValue?: string;
      }
    | { field: string; label: string; kind: 'number-range'; min: number; max: number; step?: number };

export interface WFSLayerProps extends BaseLayerProps {
    type: 'wfs';
    /** WFS service URL (e.g., 'https://example.com/geoserver/wfs') */
    wfsUrl: string;
    /** Layer type name for WFS request (e.g., 'workspace:layer_name') */
    typeName: string;
    /** CRS for WFS request (default: 'EPSG:4326') */
    crs?: string;
    /** Geometry type hint for styling ('point' | 'line' | 'polygon') - auto-detected if not specified */
    geometryType?: 'point' | 'line' | 'polygon';
    /** Optional style configuration */
    style?: {
        /** Circle radius for point features (default: 6) */
        circleRadius?: number;
        /** Zoom-interpolated circle radius: [[zoom, radius], ...] sorted ascending by zoom */
        circleRadiusByZoom?: Array<[number, number]>;
        /** Max circle radius cap to prevent overlap (default: none) */
        maxCircleRadius?: number;
        /** Data-driven circle radius based on feature property */
        circleRadiusProperty?: {
            field: string;
            /** [minValue, minRadius, maxValue, maxRadius] for interpolation */
            stops: [number, number, number, number];
        };
        /** Circle color for point features (default: '#088') */
        circleColor?: string;
        /** Data-driven circle color based on feature property */
        circleColorProperty?: {
            field: string;
            /** Array of [threshold, color] pairs for step function */
            stops: Array<[number, string]>;
            /** Default color for values below first threshold */
            defaultColor: string;
        };
        /** Categorical color match: pick a color based on a string-valued field (maplibre `match` expression) */
        circleColorMatch?: {
            field: string;
            matches: Record<string, string>;
            defaultColor: string;
        };
        /** Categorical stroke color match (parallels circleColorMatch) */
        circleStrokeColorMatch?: {
            field: string;
            matches: Record<string, string>;
            defaultColor: string;
        };
        /** Circle stroke color (default: '#fff') */
        circleStrokeColor?: string;
        /** Circle stroke width (default: 1) */
        circleStrokeWidth?: number;
        /** Fill color for polygon features (default: '#088') */
        fillColor?: string;
        /** Line color for line features or polygon outlines (default: '#333') */
        lineColor?: string;
        /** Line width (default: 2) */
        lineWidth?: number;
        /** Renders an additional symbol layer driven by an icon-image expression. When set, a SymbolLayer is created alongside the circle layer; visibility is toggled via the vectorLayerSymbology prop. */
        iconImageExpression?: unknown[];
        /** Symbology mode key this icon represents (e.g. 'box-type'). Used to gate visibility against vectorLayerSymbology. */
        iconSymbologyKey?: string;
        /** Zoom-interpolated icon size, [[zoom, size], ...] */
        iconSizeByZoom?: Array<[number, number]>;
        /** Static icon size (used if iconSizeByZoom not set) */
        iconSize?: number;
        /** Hook called once per data load to register sprites for the symbol layer */
        registerSprites?: (map: import('maplibre-gl').Map, features: import('geojson').Feature[]) => void;
        /** Legend-facing metadata for the pie-wedge symbology mode. Codes order drives swatch order. */
        pieGlyphLegend?: {
            codes: readonly string[];
            colors: Record<string, string>;
        };
    };
    /** Optional sublayer config for popups/queries */
    sublayers?: ExtendedSublayerProperties[];
}

export interface GroupLayerProps extends BaseLayerProps {
    type: 'group';
    layers?: LayerProps[];
}


export type LayerProps = WMSLayerProps | PMTilesLayerProps | COGLayerProps | WFSLayerProps | GroupLayerProps | ArcGISMapServerLayerProps | BaseLayerProps;

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
    /** Optional description shown as tooltip on the field label */
    description?: string;
    /**
     * STAC-backed related table: the asset key (e.g. 'enmin_ucrc_boxes') on the layer's
     * STAC item. When set, the resolver fills url/matchingField/targetField/fetchMode from
     * the asset's href + ugs:foreign_keys, and this entry carries ONLY presentation (UX).
     * Author EXACTLY ONE of `stacAsset` (STAC-driven) or `url` (legacy PostgREST/WFS).
     * After resolution the entry is always fully populated, so consumers treat
     * url/matchingField/targetField as present.
     */
    stacAsset?: string;
    matchingField?: string;
    targetField?: string;
    url?: string;
    headers?: Record<string, string>;
    displayFields?: DisplayField[];
    logicalOperator?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    /** How to display the related data. 'list' shows label:value pairs (default), 'table' shows a proper table with headers, 'gallery' renders a photo gallery */
    displayAs?: 'list' | 'table' | 'gallery';
    /** Render in a collapsible accordion. Defaults to true when `fieldLabel` is set, else inline. */
    collapsible?: boolean;
    /** Required when displayAs is 'gallery'. Field name containing the full-size image URL */
    galleryUrlField?: string;
    /** Optional when displayAs is 'gallery'. Field name containing the thumbnail URL. Falls back to galleryUrlField if not set */
    galleryThumbnailField?: string;
    /** Optional transform to derive thumbnail path from the galleryUrlField value. Takes precedence over galleryThumbnailField */
    galleryThumbnailTransform?: (urlFieldValue: string) => string;
    /** Optional when displayAs is 'gallery'. Field name to use as the image caption/label */
    galleryLabelField?: string;
    /** Optional base URL prepended to gallery URL field values */
    galleryBaseUrl?: string;
    /** Optional metadata fields to display alongside the image in the lightbox */
    galleryMetadataFields?: { field: string; label: string }[];
    /** Fetch mode: 'postgrest' (default), 'wfs' for GeoServer WFS, or 'parquet' for STAC geoparquet via duckdb-wasm */
    fetchMode?: 'postgrest' | 'wfs' | 'parquet';
    /** WFS typeName (required when fetchMode is 'wfs'), e.g. 'emp:sco2_with_grid' */
    wfsTypeName?: string;
}


export interface DisplayField {
    field: string;
    label?: string;
    /** Format numeric values: 'number' (thousands), 'currency' (USD), 'percent'. Applied before transform. */
    format?: 'number' | 'currency' | 'percent';
    /** `allRows` lets cell renderers share a bulk fetch via one react-query key. */
    transform?: (value: string, row?: Record<string, unknown>, allRows?: Record<string, unknown>[]) => React.ReactNode;
}

/** A single pivoted row in a popup fields table. */
export interface PopupFieldsTableField {
    /** Name shown in the label column. */
    label: string;
    /** Field config used to read and format the value. */
    config: FieldConfig;
    /** Unit appended to the formatted value in the measurement column, e.g. 'mg/l'. */
    unit?: string;
}

/** Configuration for rendering a subset of popup fields as a table inside a collapsible dropdown. */
export interface PopupFieldsTableConfig {
    /** Label shown on the collapsible section header. */
    sectionLabel: string;
    /** Header for the left (label) column. Omit to hide the header row. */
    labelHeader?: string;
    /** Header for the right (value) column. Omit to hide the header row. */
    valueHeader?: string;
    /** Fields rendered as pivoted rows (label | value), in order. */
    fields: PopupFieldsTableField[];
}

// Interface for composite symbol results
export interface CompositeSymbolResult {
    symbol?: SVGSVGElement;
    html?: HTMLElement | SVGSVGElement;
    isComposite: boolean;
    symbolizers: unknown[];
}