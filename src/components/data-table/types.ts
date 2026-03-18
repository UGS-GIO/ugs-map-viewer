import type { RowData as TanstackRowData } from '@tanstack/react-table';
import type { ExtendedFeature } from '@/components/maps/popups/types';
import type { FieldConfig } from '@/lib/types/mapping-types';
import type { RelatedDataMap } from '@/hooks/use-bulk-related-table';

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

// Module augmentation for TanStack Table meta — shared across table files
// so column builders and the main component agree on the meta shape.
// Type params must match TanStack's originals exactly; can't prefix with _.
/* eslint-disable @typescript-eslint/no-unused-vars */
declare module '@tanstack/react-table' {
    interface TableMeta<TData extends TanstackRowData> {
        expandedTables: Record<string, number | null>;
        setExpandedTables: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
        relatedDataMaps: RelatedDataMap[];
        relatedLoading: boolean;
    }
    interface ColumnMeta<TData extends TanstackRowData, TValue> {
        columnConfig?: ColumnConfig;
    }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
