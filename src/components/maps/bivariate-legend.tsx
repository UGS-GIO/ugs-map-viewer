import { useQuery } from '@tanstack/react-query';
import { Legend, LegendRule } from '@/lib/types/geoserver-types';
import { PMTilesRender } from '@/lib/types/mapping-types';
import { queryKeys } from '@/lib/query-keys';

interface BivariateLegendProps {
    wmsUrl?: string;
    layerName?: string;
    stacLegend?: PMTilesRender['legend'];
    xLabel: string;
    yLabel: string;
}

const CELL_RE = /^bivariate_(\d+)_(\d+)$/;

export interface BivariateGrid {
    colors: string[][];
    rows: number;
    cols: number;
    yTicks: string[];
    xTicks: string[];
    noData: { color: string; opacity: number; label: string } | null;
}

/** Extract short tick label: "High Cap / Low Cost" → "High" (first word only) */
function shortLabel(title: string, index: 0 | 1): string {
    const part = title.split(' / ')[index]?.trim() ?? '';
    return part.split(' ')[0] ?? '';
}

function buildGrid(
    cells: { row: number; col: number; color: string; title: string }[],
    noData: BivariateGrid['noData'],
): BivariateGrid | null {
    if (!cells.length) return null;

    const rows = Math.max(...cells.map(c => c.row)) + 1;
    const cols = Math.max(...cells.map(c => c.col)) + 1;

    const colors = Array.from({ length: rows }, () => Array.from({ length: cols }, () => '#000'));
    const yTicks = Array.from({ length: rows }, () => '');
    const xTicks = Array.from({ length: cols }, () => '');

    for (const c of cells) {
        colors[c.row][c.col] = c.color;
        if (!yTicks[c.row]) yTicks[c.row] = shortLabel(c.title, 0);
        if (!xTicks[c.col]) xTicks[c.col] = shortLabel(c.title, 1);
    }

    return { colors, rows, cols, yTicks, xTicks, noData };
}

function parseRules(rules: LegendRule[]): BivariateGrid | null {
    const cells: { row: number; col: number; color: string; title: string }[] = [];
    let noData: BivariateGrid['noData'] = null;

    for (const rule of rules) {
        const poly = rule.symbolizers?.[0]?.Polygon;
        if (!poly) continue;

        if (rule.name === 'bivariate_nodata') {
            noData = {
                color: poly.fill ?? '#fff',
                opacity: parseFloat(poly['fill-opacity'] ?? '1'),
                label: rule.title || 'No Data',
            };
            continue;
        }

        const m = rule.name?.match(CELL_RE);
        if (m) {
            cells.push({ row: +m[1], col: +m[2], color: poly.fill ?? '#000', title: rule.title || '' });
        }
    }

    return buildGrid(cells, noData);
}

export function parseStacBivariateLegend(entries: NonNullable<PMTilesRender['legend']>): BivariateGrid | null {
    const cells: { row: number; col: number; color: string; title: string }[] = [];
    let noData: BivariateGrid['noData'] = null;

    for (const entry of entries) {
        const key = entry.value ?? '';
        if (key === 'bivariate_nodata') {
            noData = {
                color: entry.color,
                opacity: 0.3,
                label: entry.label || 'Not Evaluated',
            };
            continue;
        }

        const m = key.match(CELL_RE);
        if (m) {
            cells.push({ row: +m[1], col: +m[2], color: entry.color, title: entry.label || '' });
        }
    }

    return buildGrid(cells, noData);
}

export function BivariateLegend({ wmsUrl, layerName, stacLegend, xLabel, yLabel }: BivariateLegendProps) {
    const stacGrid = stacLegend ? parseStacBivariateLegend(stacLegend) : null;
    const { data: wmsGrid, isLoading, error } = useQuery({
        queryKey: queryKeys.layers.wmsLegend(layerName ?? '', wmsUrl ?? ''),
        queryFn: async () => {
            const url = `${wmsUrl}?service=WMS&request=GetLegendGraphic&format=application/json&layer=${layerName}&version=1.3.0`;
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const legend: Legend = await res.json();
            return parseRules(legend?.Legend?.[0]?.rules ?? []);
        },
        staleTime: 1000 * 60 * 60,
        enabled: !stacGrid && !!wmsUrl && !!layerName,
    });

    const grid = stacGrid ?? wmsGrid;

    if (!stacGrid && isLoading) return <div className="text-xs text-muted-foreground">Loading legend...</div>;
    if (!stacGrid && error) return <div className="text-xs text-destructive">Error loading legend</div>;
    if (!grid) return null;

    // Single CSS grid: [y-label] [y-ticks] [color cols...]
    // Rows: x-label | color rows... | x-ticks | no-data
    const colTemplate = `auto auto repeat(${grid.cols}, 1fr)`;

    return (
        <div
            role="img"
            aria-label={`Bivariate legend: ${yLabel} (vertical axis) vs ${xLabel} (horizontal axis), ${grid.rows} by ${grid.cols} grid`}
            className="grid items-center text-xs text-foreground gap-1 w-4/5"
            style={{ gridTemplateColumns: colTemplate }}
        >
            {/* X-axis label spans color columns */}
            <div style={{ gridColumn: `3 / -1` }} className="text-center font-medium pb-0.5" aria-hidden="true">
                {xLabel} &rarr;
            </div>

            {/* Y-axis label (rotated, spans all color rows) */}
            <div
                className="font-medium text-center"
                aria-hidden="true"
                style={{
                    gridColumn: 1,
                    gridRow: `2 / ${2 + grid.rows}`,
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                }}
            >
                {yLabel} &rarr;
            </div>

            {/* Color rows with y-tick labels */}
            {grid.colors.map((row, r) => (
                <div key={`row-${r}`} className="contents" aria-hidden="true">
                    <span className="text-right pr-0.5">{grid.yTicks[r]}</span>
                    {row.map((color, c) => (
                        <div
                            key={`${r}-${c}`}
                            className="aspect-square rounded-[2px]"
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
            ))}

            {/* X-axis tick labels under color columns */}
            <div style={{ gridColumn: '1 / 3' }} />
            {grid.xTicks.map((label, i) => (
                <span key={`xt-${i}`} className="text-center">
                    {label}
                </span>
            ))}

            {/* No-data swatch */}
            {grid.noData && (
                <div
                    className="flex items-center gap-1.5 pt-1"
                    style={{ gridColumn: `3 / -1` }}
                >
                    <div
                        className="w-5 h-5 rounded-[2px] border border-border shrink-0"
                        style={{ backgroundColor: grid.noData.color, opacity: grid.noData.opacity }}
                    />
                    <span>{grid.noData.label}</span>
                </div>
            )}
        </div>
    );
}
