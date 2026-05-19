import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
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

interface ParquetDownloadMenuProps {
    /** GeoParquet URL — when present, the menu renders. */
    parquetUrl: string;
    /** Used as the download filename stem */
    layerTitle: string;
}

export const ParquetDownloadMenu: React.FC<ParquetDownloadMenuProps> = ({ parquetUrl, layerTitle }) => {
    const { data: schema, isLoading: schemaLoading, isError: schemaError } = useParquetSchema(parquetUrl);

    const download = useMutation({
        mutationFn: async (format: ExportFormat) => {
            const { exportParquet, safeFilename } = await import('@/lib/duckdb-export');
            await exportParquet({
                parquetUrl,
                filename: safeFilename(layerTitle),
                format,
                geometryColumn: schema?.geometryColumn ?? null,
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="stacked"
                    disabled={disabled}
                    className="flex flex-col items-center px-3 py-2 min-w-[80px] basis-[calc((100%-1rem)/3)] grow-0 gap-1"
                    aria-label="Download layer data"
                >
                    {(isDownloading || schemaLoading)
                        ? <Loader2 className="h-5 w-5 animate-spin" />
                        : <Download className="h-5 w-5" />}
                    <span className="text-xs">
                        {isDownloading ? 'Exporting…' : schemaLoading ? 'Loading…' : 'Download'}
                    </span>
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
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
