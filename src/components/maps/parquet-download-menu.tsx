import { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useParquetSchema } from '@/hooks/use-parquet-schema';
import { EXPORT_FORMATS, availableFormats, type ExportFormat } from '@/lib/export-formats';
import { shapefileFieldChecks } from '@/lib/gdal-export';
import type { RelatedTable } from '@/lib/types/mapping-types';

interface ParquetDownloadMenuProps {
    /** GeoParquet URL — when present, the menu renders. */
    parquetUrl: string;
    /** Used as the download filename stem */
    layerTitle: string;
    /** Related tables configured on the layer (e.g. formation tops, geochemistry). When
     * non-empty, adds an "Include related data" option that bundles them as a zip. */
    relatedTables?: RelatedTable[];
    /** Icon-only trigger for dense lists; default is the stacked icon+label button. */
    compact?: boolean;
}

export const ParquetDownloadMenu: React.FC<ParquetDownloadMenuProps> = ({ parquetUrl, layerTitle, relatedTables, compact = false }) => {
    // Schema probe (a small range request) waits for the menu to actually open, so
    // rendering a list of these doesn't fire a network request per row up front.
    // `enabled` (not the query key) gates the fetch — selecting a DropdownMenuItem
    // auto-closes the menu, and closing sets `open` false right as the mutation
    // fires; if that also blanked the query key, the just-fetched geometryColumn
    // would vanish mid-export and every geometry format would fail.
    const [open, setOpen] = useState(false);
    const { data: schema, isLoading: schemaLoading, isError: schemaError } = useParquetSchema(parquetUrl, open);
    const [includeRelated, setIncludeRelated] = useState(true);
    const hasRelatedTables = (relatedTables?.length ?? 0) > 0;

    // Shapefile silently truncates field names past 10 chars and drops columns whose
    // truncations collide. Warned up front from the schema we already have — the user
    // can still proceed, but not unknowingly.
    const shapefileIssues = useMemo(() => {
        if (!schema) return null;
        const attrs = schema.columns.filter(c => c !== schema.geometryColumn);
        const { longNames, collisions, tooManyFields, fieldCount } = shapefileFieldChecks(attrs);
        if (!longNames.length && !collisions.length && !tooManyFields) return null;
        return { longNames, collisions, tooManyFields, fieldCount };
    }, [schema]);

    const download = useMutation({
        mutationFn: async (format: ExportFormat) => {
            if (format === 'shp' && shapefileIssues) {
                const parts = [
                    shapefileIssues.collisions.length
                        ? `${shapefileIssues.collisions.length} column name(s) collide after truncation and will be dropped`
                        : null,
                    shapefileIssues.longNames.length
                        ? `${shapefileIssues.longNames.length} name(s) shortened to 10 characters`
                        : null,
                    shapefileIssues.tooManyFields ? `${shapefileIssues.fieldCount} fields exceeds the 255 limit` : null,
                ].filter(Boolean);
                toast.warning('Shapefile format limits', { description: parts.join('; ') });
            }
            const { exportParquet, safeFilename } = await import('@/lib/duckdb-export');
            await exportParquet({
                parquetUrl,
                filename: safeFilename(layerTitle),
                format,
                geometryColumn: schema?.geometryColumn ?? null,
                relatedTables: hasRelatedTables && includeRelated ? relatedTables : undefined,
                onProgress: (stage) => {
                    if (stage.stage === 'error') {
                        // Let mutation onError handle display; no-op here
                    }
                },
            });
        },
        onSuccess: (_data, format) => {
            // Track completed download in Google Tag Manager dataLayer
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event: 'dataset_download',
                layer_title: layerTitle,
                format,
                has_geometry: schema?.hasGeometry ?? false,
                column_count: schema?.columns.length ?? 0,
                row_count: schema?.rowCount ?? 0,
            });
        },
        onError: (err) => {
            toast.error('Download failed', {
                description: err instanceof Error ? err.message : String(err),
            });
        },
    });

    const isDownloading = download.isPending;
    const disabled = isDownloading || schemaLoading || schemaError;
    const formats = availableFormats(schema?.hasGeometry ?? false);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size={compact ? 'icon' : 'stacked'}
                    disabled={disabled}
                    className={compact
                        ? 'h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground'
                        : 'flex flex-col items-center px-3 py-2 min-w-[80px] flex-1 gap-1'}
                    aria-label={compact ? `Download ${layerTitle}` : 'Download layer data'}
                >
                    {(isDownloading || schemaLoading)
                        ? <Loader2 className={compact ? 'h-4 w-4 animate-spin' : 'h-5 w-5 animate-spin'} />
                        : <Download className={compact ? 'h-4 w-4' : 'h-5 w-5'} />}
                    {!compact && (
                        <span className="text-xs">
                            {isDownloading ? 'Exporting…' : schemaLoading ? 'Loading…' : 'Download'}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Export format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {formats.map(format => {
                    const meta = EXPORT_FORMATS[format];
                    return (
                        <DropdownMenuItem key={format} onClick={() => download.mutate(format)}>
                            {meta.label}
                            {meta.hint && (
                                <span className="ml-auto text-xs text-muted-foreground">{meta.hint}</span>
                            )}
                        </DropdownMenuItem>
                    );
                })}
                {hasRelatedTables && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                            Options
                        </DropdownMenuLabel>
                        <DropdownMenuCheckboxItem
                            checked={includeRelated}
                            onCheckedChange={setIncludeRelated}
                            onSelect={(e) => e.preventDefault()}
                        >
                            Include related data
                        </DropdownMenuCheckboxItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
