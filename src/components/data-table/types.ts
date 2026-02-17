import type { ExtendedFeature } from '@/components/maps/popups/types';
import type { FieldConfig } from '@/lib/types/mapping-types';

export type ViewMode = 'map' | 'split' | 'table';

export interface ColumnConfig {
    id: string;
    label: string;
    field: string;
    /** Original field config for formatting (unit, decimalPlaces, transform) */
    fieldConfig?: FieldConfig;
}

export interface RowData {
    id: string;
    sourceCRS: string;
    layerTitle: string;
    feature: ExtendedFeature;
    properties: Record<string, unknown>;
    maxZoomLevel?: number;
}
