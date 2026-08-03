import type { FilterSchema } from '@/lib/filter/types';

/**
 * Power Plants is fully warehouse-sourced (PMTiles + geoparquet from the STAC item, no
 * PostgREST table behind it) — `stacItemId` alone drives distinct-option queries straight
 * off the geoparquet via DuckDB-wasm (see `useDistinctFieldOptions`), no `tableUrl` needed.
 * `primsource` is the only field surfaced, matching the STAC render's colour category
 * (see `SymbologyLegend`) — capacity/operator filters can be added here later if needed.
 */
export const powerplantsFilterSchema: FilterSchema = {
    recordKey: 'powerplants',
    stacItemId: 'enmin_powerplants',
    fields: [
        { kind: 'multiSelect', field: 'primsource', label: 'Plant Type' },
    ],
};

export default powerplantsFilterSchema;
