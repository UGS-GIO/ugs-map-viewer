/**
 * Collapse raw per-sample rows (one row per physical box/sample) into contiguous
 * depth intervals per sample type. Used by the UCRC Inventory "Samples" popup
 * table (ALL-4766) to summarize dozens of Core/Cuttings box records into a
 * handful of top/bottom ranges, starting a new interval whenever the gap to
 * the next same-type sample exceeds `maxGap` (default 10 ft).
 */

export interface SampleIntervalOptions {
    /** Field holding the sample type/category (e.g. 'box_type_group'). */
    typeField: string;
    /** Fallback type field used when `typeField` is null/empty (e.g. the finer 'box_type'). */
    typeFallbackField?: string;
    /** Field holding the top (shallow) depth. */
    topField: string;
    /** Field holding the bottom (deep) depth. */
    bottomField: string;
    /** Max gap between adjacent same-type samples that still counts as continuous. Defaults to 10. */
    maxGap?: number;
}

export interface SampleInterval {
    sample_type: string;
    top_ft: number;
    bottom_ft: number;
    [key: string]: unknown;
}

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function mergeSampleIntervals(
    rows: Record<string, unknown>[],
    { typeField, typeFallbackField, topField, bottomField, maxGap = 10 }: SampleIntervalOptions
): Record<string, unknown>[] {
    const byType = new Map<string, { top: number; bottom: number }[]>();

    for (const row of rows) {
        const top = toNumber(row[topField]);
        const bottom = toNumber(row[bottomField]);
        if (top === null || bottom === null) continue;

        const rawType = row[typeField] ?? (typeFallbackField ? row[typeFallbackField] : undefined);
        const type = String(rawType ?? '').trim();
        if (!type) continue;

        const list = byType.get(type) ?? [];
        list.push({ top: Math.min(top, bottom), bottom: Math.max(top, bottom) });
        byType.set(type, list);
    }

    const intervals: SampleInterval[] = [];
    for (const [type, spans] of byType) {
        spans.sort((a, b) => a.top - b.top);

        let current: { top: number; bottom: number } | null = null;
        for (const span of spans) {
            if (!current) {
                current = { ...span };
                continue;
            }
            const gap = span.top - current.bottom;
            if (gap <= maxGap) {
                current.bottom = Math.max(current.bottom, span.bottom);
            } else {
                intervals.push({ sample_type: type, top_ft: current.top, bottom_ft: current.bottom });
                current = { ...span };
            }
        }
        if (current) {
            intervals.push({ sample_type: type, top_ft: current.top, bottom_ft: current.bottom });
        }
    }

    // Group by type (alphabetical), then by top depth within each type — matches how the
    // UCRC team reviews continuous vs. gapped material. Table headers remain clickable for
    // re-sorting.
    intervals.sort((a, b) => a.sample_type.localeCompare(b.sample_type) || a.top_ft - b.top_ft);
    return intervals;
}
