/**
 * Collapse raw per-sample rows (one row per physical box/sample) into contiguous
 * depth intervals per sample type. Used by the UCRC Inventory "Sample Types" popup
 * table (ALL-4766) to summarize dozens of Core/Cuttings box records into a
 * handful of top/bottom ranges, starting a new interval whenever the gap to
 * the next same-type sample exceeds `maxGap` (default 10 ft).
 */

import type { PMTilesRender } from '@/lib/types/mapping-types'

/**
 * Static last-resort fallback for bucketing a raw `box_type_code` value (the per-box
 * code column on enmin_ucrc_boxes, e.g. "CORESAMPLES", "CUTTINGS" -- the same vocabulary
 * as the aggregate `box_type_codes` field the wells layer uses for its own by-boxtype map
 * symbology) into Core / Cuttings / Other. Only used when the STAC `by-boxtype` legend
 * can't be read off the wells layer's `renders` (see `resolveSampleTypeGroupBy` below,
 * which is the actual source of truth used by the popup).
 *
 * `box_type_group` also exists on the published data but is wrong upstream: every
 * Core-family type is labelled OTHER, and only CUTTINGS is correct — do not use it.
 *
 * Keep this in sync with `ugs:renders["by-boxtype"].legend` on the enmin_ucrc_wells STAC
 * item if the warehouse ever changes it. Verified 1:1 against every distinct
 * `box_type_code` value present in production enmin_ucrc_boxes on 2026-07-29.
 */
const FALLBACK_CORE_CODES = new Set([
  'BUTTS',
  'CORESAMPLES',
  'SKELETONIZED CORE',
  'SLABS',
  'SPOT CORES',
  'WHOLE CORE',
])
const FALLBACK_CUTTINGS_CODES = new Set(['CORE CHIPS', 'CUTTINGS'])

function fallbackGroupByCode(rawCode: unknown): string {
  const normalized = String(rawCode ?? '')
    .trim()
    .toUpperCase()
  if (!normalized) return ''
  if (FALLBACK_CORE_CODES.has(normalized)) return 'Core'
  if (FALLBACK_CUTTINGS_CODES.has(normalized)) return 'Cuttings'
  return 'Other'
}

/**
 * Builds a `box_type_code` -> sample-group label lookup from the `by-boxtype` STAC render
 * on the UCRC wells layer (`ugs:renders["by-boxtype"]`, field `box_type_codes`). That
 * legend is the warehouse's own source of truth for the Core/Cuttings/Other grouping
 * (mirrors the map's by-boxtype symbology) — this table reads it instead of re-declaring
 * the grouping locally.
 *
 * Returns null if the render/legend isn't present on `renders` (STAC schema changed
 * upstream, or renders haven't resolved yet), so callers can fall back.
 */
export function groupByFromByBoxtypeLegend(
  renders: PMTilesRender[] | undefined
): ((rawCode: unknown) => string) | null {
  const render = renders?.find((r) => r.field === 'box_type_codes')
  if (!render?.legend?.length) return null

  const map = new Map<string, string>()
  for (const entry of render.legend) {
    for (const v of entry.values ?? []) {
      map.set(v.value.trim().toUpperCase(), entry.label)
    }
  }
  if (map.size === 0) return null

  return (rawCode: unknown): string => {
    const normalized = String(rawCode ?? '')
      .trim()
      .toUpperCase()
    if (!normalized) return ''
    return map.get(normalized) ?? 'Other'
  }
}

/**
 * Resolves the `groupBy` classifier for the "Sample Types" popup table: prefers the STAC
 * `by-boxtype` legend off the wells layer's already-resolved `renders` (source of truth),
 * falls back to a static code map only if that legend isn't available for some reason.
 * `box_type_group` (broken upstream, see ALL-5379) can't be used for this instead.
 */
export function resolveSampleTypeGroupBy(
  renders: PMTilesRender[] | undefined
): (rawCode: unknown) => string {
  const dynamic = groupByFromByBoxtypeLegend(renders)
  if (dynamic) return dynamic
  console.error(
    'Sample Types popup: STAC by-boxtype legend missing on enmin_ucrc_wells renders — using static box_type_code fallback grouping.'
  )
  return fallbackGroupByCode
}

export interface SampleIntervalOptions {
  /** Field holding the raw sample type (e.g. 'box_type'). */
  typeField: string
  /**
   * Maps a raw `typeField` value to its display bucket (e.g. "Whole Core" -> "Core").
   * Defaults to using the raw value as-is (trimmed to a string) when omitted.
   */
  groupBy?: (rawType: unknown) => string
  /** Field holding the top (shallow) depth. */
  topField: string
  /** Field holding the bottom (deep) depth. */
  bottomField: string
  /**
   * Optional notes field to roll up into each merged interval (e.g. 'notes_public').
   * Distinct non-empty notes from every contributing row are deduped and joined with '; '.
   * Omitted from the result entirely when no contributing row has a note.
   */
  notesField?: string
  /** Max gap between adjacent same-type samples that still counts as continuous. Defaults to 10. */
  maxGap?: number
}

export interface SampleInterval {
  sample_type: string
  top_ft: number
  bottom_ft: number
  notes_public?: string
  [key: string]: unknown
}

interface Span {
  top: number
  bottom: number
  notes: string[]
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

const defaultGroupBy = (rawType: unknown): string =>
  String(rawType ?? '').trim()

export function mergeSampleIntervals(
  rows: Record<string, unknown>[],
  {
    typeField,
    groupBy = defaultGroupBy,
    topField,
    bottomField,
    notesField,
    maxGap = 10,
  }: SampleIntervalOptions
): SampleInterval[] {
  const byType = new Map<string, Span[]>()

  for (const row of rows) {
    const top = toNumber(row[topField])
    const bottom = toNumber(row[bottomField])
    if (top === null || bottom === null) continue

    const type = groupBy(row[typeField])
    if (!type) continue

    const note = notesField ? String(row[notesField] ?? '').trim() : ''

    const list = byType.get(type) ?? []
    list.push({
      top: Math.min(top, bottom),
      bottom: Math.max(top, bottom),
      notes: note ? [note] : [],
    })
    byType.set(type, list)
  }

  const intervals: SampleInterval[] = []
  for (const [type, spans] of byType) {
    spans.sort((a, b) => a.top - b.top)

    let current: Span | null = null
    const flush = () => {
      if (!current) return
      const notes = [...new Set(current.notes)].join('; ')
      intervals.push({
        sample_type: type,
        top_ft: current.top,
        bottom_ft: current.bottom,
        ...(notes ? { notes_public: notes } : {}),
      })
    }

    for (const span of spans) {
      if (!current) {
        current = { ...span, notes: [...span.notes] }
        continue
      }
      const gap = span.top - current.bottom
      if (gap <= maxGap) {
        current.bottom = Math.max(current.bottom, span.bottom)
        current.notes.push(...span.notes)
      } else {
        flush()
        current = { ...span, notes: [...span.notes] }
      }
    }
    flush()
  }

  // Group by type (alphabetical), then by top depth within each type — matches how the
  // UCRC team reviews continuous vs. gapped material. Table headers remain clickable for
  // re-sorting.
  intervals.sort(
    (a, b) => a.sample_type.localeCompare(b.sample_type) || a.top_ft - b.top_ft
  )
  return intervals
}
