/**
 * Collapse raw per-sample rows (one row per physical box/sample) into contiguous
 * depth intervals per sample type. Used by the UCRC Inventory "Sample Types" popup
 * table to summarize dozens of Core/Cuttings box records into a handful of top/bottom
 * ranges, starting a new interval whenever the gap to the next same-type sample
 * exceeds `maxGap` (default 10 ft).
 */

/**
 * Display-cases a `box_type_group` value for the popup table. The warehouse publishes the
 * group as an uppercase code ("CORE"/"CUTTINGS"/"OTHER"); the table shows it title-cased.
 *
 * Purely cosmetic — the grouping itself is the warehouse's (`BoxType.category` on the UCRC
 * app, published as `box_type_group`). Casing every word rather than mapping known groups
 * keeps this free of any membership table, so a new group renders correctly on arrival.
 */
export function titleCaseGroup(rawGroup: unknown): string {
  return String(rawGroup ?? '')
    .trim()
    .toLowerCase()
    .replace(/\S+/g, (word) => word[0].toUpperCase() + word.slice(1))
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
