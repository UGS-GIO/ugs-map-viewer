import type { FeatureCollection, Geometry, GeoJsonProperties, Feature } from 'geojson';

interface BaseConfig {
    url?: string;
    sourceName?: string;
    layerName?: string;
    headers?: Record<string, string>;
    displayField: string;
}

export interface PostgRESTConfig extends BaseConfig {
    type: 'postgREST';
    url: string;
    layerName?: string;
    params?: PostgRESTParams;
    functionName?: string;
    /** Extra parameters passed to the PostgREST function (e.g. { search_scale: 'small' }) */
    functionParams?: Record<string, string>;
    searchTerm?: string;
    placeholder?: string;
    groupByField?: string;
    groupLabels?: Record<string, string>;
    secondaryDisplayField?: string;
}

type PostgRESTParams =
    | { targetField: string; select?: string; targetFields?: never }
    | { targetFields: string[]; select?: string; targetField?: never }
    | { select: string; targetField?: never; targetFields?: never }
    | { searchKeyParam: string; targetField?: never; targetFields?: never; select?: never };

export interface MasqueradeConfig extends BaseConfig {
    type: 'masquerade';
    url: string;
    maxSuggestions?: number;
    outSR?: number;
    placeholder?: string;
}

export interface ParquetSearchConfig extends BaseConfig {
    type: 'parquet';
    parquetUrl: string;
    layerName?: string;
    placeholder?: string;
    params?: {
        targetFields?: string[];
        targetField?: string;
    };
    /**
     * Columns the warehouse doesn't store, computed in SQL and selected under an alias —
     * the parquet equivalent of what a PostgREST search function used to assemble
     * server-side (e.g. qfaults `concatnames`, geologic-unit `unit_label`). The alias is
     * usable anywhere a real column is: `displayField`, `targetFields`, `groupByField`.
     * Values are raw SQL, so they are authored here and never built from user input.
     */
    derivedFields?: Record<string, string>;
    groupByField?: string;
    groupLabels?: Record<string, string>;
    /**
     * Result grouping by WHICH field matched, rather than by a column's value — the
     * `match_type` a search RPC used to return. Evaluated in order against each row;
     * the first field containing a search token wins, and its `key` is the group.
     * Ignored when `groupByField` is set.
     */
    groupByMatch?: Array<{ key: string; field: string }>;
    secondaryDisplayField?: string;
    geometryField?: string;
    /** Unique column used to fetch geometry for a chosen suggestion (search itself is geometry-free). */
    idField?: string;
}

export type SearchSourceConfig = PostgRESTConfig | MasqueradeConfig | ParquetSearchConfig;
export type ExtendedGeometry = Geometry & { crs?: { properties: { name: string; }; type: string; }; };

export interface Suggestion {
    text: string;
    magicKey: string;
    isCollection?: boolean;
}

export type QueryData = Suggestion[] | FeatureCollection<Geometry, GeoJsonProperties>;

export interface QueryResultWrapper {
    data: QueryData | undefined;
    error: Error | null;
    isLoading: boolean;
    isError: boolean;
    type: SearchSourceConfig['type'];
}

export interface SearchComboboxHandle {
    clear: () => void;
}

export interface SearchComboboxProps {
    config: SearchSourceConfig[];
    onFeatureSelect?: (searchResult: Feature<Geometry, GeoJsonProperties> | FeatureCollection<Geometry, GeoJsonProperties> | null, _sourceUrl: string, sourceIndex: number, searchConfig: SearchSourceConfig[], map: maplibregl.Map) => void;
    onCollectionSelect?: (collection: FeatureCollection<Geometry, GeoJsonProperties> | null, _sourceUrl: string | null, _sourceIndex: number, searchConfig: SearchSourceConfig[], map: maplibregl.Map) => void;
    className?: string;
    /**
     * The authored `sourceName` of the source to pre-select on load (and restore on
     * clear). Read once at mount for the initial selection, so it — and `config` —
     * must be render-stable. Omitted → no source pre-selected, so the combobox
     * searches all sources.
     */
    defaultSourceName?: string;
}
