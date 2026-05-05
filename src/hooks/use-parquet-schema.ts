import { useQuery } from '@tanstack/react-query';
import { parquetMetadataAsync, asyncBufferFromUrl } from 'hyparquet';
import { queryKeys } from '@/lib/query-keys';

/** Geometry column candidates, in priority order. */
const GEOM_CANDIDATES = ['geometry', 'geom', 'wkb_geometry'];

export interface ParquetSchema {
    columns: string[];
    geometryColumn: string | null;
    hasGeometry: boolean;
}

const fetchSchema = async (url: string): Promise<ParquetSchema> => {
    // hyparquet reads the parquet footer via HTTP range requests — ~10KB byte transfer, no full download.
    const buffer = await asyncBufferFromUrl({ url });
    const metadata = await parquetMetadataAsync(buffer);
    // schema[0] is the root group; actual columns start at index 1.
    const columns = metadata.schema.slice(1).map(s => s.name);
    const geometryColumn = GEOM_CANDIDATES.find(c => columns.includes(c)) ?? null;
    return { columns, geometryColumn, hasGeometry: !!geometryColumn };
};

/** Probe a parquet URL's schema once, cache forever. Runs on mount when url is set. */
export const useParquetSchema = (url: string | undefined) => {
    return useQuery({
        queryKey: queryKeys.modules.parquetSchema(url ?? ''),
        queryFn: () => fetchSchema(url!),
        enabled: !!url,
        staleTime: Infinity,
        retry: 1,
    });
};
