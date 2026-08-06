import { useQuery } from '@tanstack/react-query';
import { parquetMetadataAsync, asyncBufferFromUrl } from 'hyparquet';
import { queryKeys } from '@/lib/query-keys';

/** Geometry column candidates, in priority order. */
const GEOM_CANDIDATES = ['geometry', 'geom', 'wkb_geometry'];

export interface ParquetSchema {
    columns: string[];
    geometryColumn: string | null;
    hasGeometry: boolean;
    rowCount: number;
}

const fetchSchema = async (url: string): Promise<ParquetSchema> => {
    // hyparquet reads the parquet footer via HTTP range requests — ~10KB byte transfer, no full download.
    const buffer = await asyncBufferFromUrl({ url });
    const metadata = await parquetMetadataAsync(buffer);
    // schema[0] is the root group; actual columns start at index 1.
    const columns = metadata.schema.slice(1).map(s => s.name);
    const geometryColumn = GEOM_CANDIDATES.find(c => columns.includes(c)) ?? null;
    // metadata.num_rows is a bigint; coerce for plain JSON/analytics use.
    const rowCount = Number(metadata.num_rows);
    return { columns, geometryColumn, hasGeometry: !!geometryColumn, rowCount };
};

/**
 * Probe a parquet URL's schema once, cache forever.
 *
 * `enabled` gates *fetching* only — the query key is always keyed on `url`, never
 * blanked out. That matters for callers like the download menu that want to defer
 * the fetch until first opened (`enabled: open`) but then close the menu right as
 * a download starts: blanking the key on close would re-key to an empty-string
 * cache slot and lose the just-fetched `geometryColumn` mid-export. Keeping the
 * key stable means the cached result survives regardless of `enabled` toggling.
 */
export const useParquetSchema = (url: string | undefined, enabled = true) => {
    return useQuery({
        queryKey: queryKeys.modules.parquetSchema(url ?? ''),
        queryFn: () => fetchSchema(url!),
        enabled: !!url && enabled,
        staleTime: Infinity,
        retry: 1,
    });
};
