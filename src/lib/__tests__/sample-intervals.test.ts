import { describe, it, expect, vi, afterEach } from 'vitest'
import type { PMTilesRender } from '@/lib/types/mapping-types'
import {
  mergeSampleIntervals,
  groupByFromByBoxtypeLegend,
  resolveSampleTypeGroupBy,
} from '../sample-intervals'

// Mirrors the real `ugs:renders["by-boxtype"]` legend on the enmin_ucrc_wells STAC item
// (field `box_type_codes`), fetched live from
// https://maps-assets.geology.utah.gov/warehouse/stac/ugs-serving-topics/enmin_ucrc_wells/enmin_ucrc_wells.json
const BY_BOXTYPE_RENDER: PMTilesRender = {
  id: 'by-boxtype',
  styleUrl: 'https://maps-assets.geology.utah.gov/styles/styles/enmin_ucrc_wells_current/by-boxtype.json',
  field: 'box_type_codes',
  legend: [
    {
      label: 'Core',
      color: '#8266BE',
      values: [
        { value: 'BUTTS', color: '#8266BE' },
        { value: 'CORESAMPLES', color: '#8266BE' },
        { value: 'SKELETONIZED CORE', color: '#8266BE' },
        { value: 'SLABS', color: '#8266BE' },
        { value: 'SPOT CORES', color: '#8266BE' },
        { value: 'WHOLE CORE', color: '#8266BE' },
      ],
    },
    {
      label: 'Cuttings',
      color: '#1A9641',
      values: [
        { value: 'CORE CHIPS', color: '#1A9641' },
        { value: 'CUTTINGS', color: '#1A9641' },
      ],
    },
    {
      label: 'Other',
      color: '#BDBDBD',
      values: [
        { value: 'OTHER', color: '#BDBDBD' },
        { value: 'OUTCROP SAMPLES', color: '#BDBDBD' },
        { value: 'SIDEWALL PLUGS', color: '#BDBDBD' },
        { value: 'THIN SECTIONS', color: '#BDBDBD' },
        { value: 'UNKNOWN', color: '#BDBDBD' },
      ],
    },
  ],
}

const opts = {
  typeField: 'box_type_code',
  groupBy: resolveSampleTypeGroupBy([BY_BOXTYPE_RENDER]),
  topField: 'box_top_ft',
  bottomField: 'box_bottom_ft',
}

describe('groupByFromByBoxtypeLegend', () => {
  it('buckets known Core box_type_code values from the STAC legend (case/whitespace insensitive)', () => {
    const groupBy = groupByFromByBoxtypeLegend([BY_BOXTYPE_RENDER])!
    expect(groupBy('WHOLE CORE')).toBe('Core')
    expect(groupBy('whole core')).toBe('Core')
    expect(groupBy('  BUTTS  ')).toBe('Core')
    expect(groupBy('SLABS')).toBe('Core')
    expect(groupBy('SPOT CORES')).toBe('Core')
    expect(groupBy('SKELETONIZED CORE')).toBe('Core')
    expect(groupBy('CORESAMPLES')).toBe('Core')
  })

  it('buckets known Cuttings box_type_code values', () => {
    const groupBy = groupByFromByBoxtypeLegend([BY_BOXTYPE_RENDER])!
    expect(groupBy('CUTTINGS')).toBe('Cuttings')
    expect(groupBy('CORE CHIPS')).toBe('Cuttings')
  })

  it('buckets unrecognized non-empty codes as Other', () => {
    const groupBy = groupByFromByBoxtypeLegend([BY_BOXTYPE_RENDER])!
    expect(groupBy('OUTCROP SAMPLES')).toBe('Other')
    expect(groupBy('SIDEWALL PLUGS')).toBe('Other')
    expect(groupBy('THIN SECTIONS')).toBe('Other')
    expect(groupBy('UNKNOWN')).toBe('Other')
    expect(groupBy('SOMETHING NEW')).toBe('Other')
  })

  it('returns an empty string for empty/missing codes', () => {
    const groupBy = groupByFromByBoxtypeLegend([BY_BOXTYPE_RENDER])!
    expect(groupBy('')).toBe('')
    expect(groupBy(null)).toBe('')
    expect(groupBy(undefined)).toBe('')
  })

  it('returns null when renders is undefined, empty, or missing the by-boxtype/box_type_codes render', () => {
    expect(groupByFromByBoxtypeLegend(undefined)).toBeNull()
    expect(groupByFromByBoxtypeLegend([])).toBeNull()
    expect(groupByFromByBoxtypeLegend([{ id: 'by-purpose', styleUrl: 'x', field: 'purpose', legend: [] }])).toBeNull()
  })
})

describe('resolveSampleTypeGroupBy', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prefers the STAC legend when renders are available', () => {
    const groupBy = resolveSampleTypeGroupBy([BY_BOXTYPE_RENDER])
    expect(groupBy('WHOLE CORE')).toBe('Core')
    expect(groupBy('CUTTINGS')).toBe('Cuttings')
  })

  it('falls back to the static code map and logs an error when the legend is unavailable', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const groupBy = resolveSampleTypeGroupBy(undefined)
    expect(groupBy('WHOLE CORE')).toBe('Core')
    expect(groupBy('CUTTINGS')).toBe('Cuttings')
    expect(groupBy('OUTCROP SAMPLES')).toBe('Other')
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})

describe('mergeSampleIntervals', () => {
  it('matches the ALL-4766 example: splits Core on a >10 gap, keeps Cuttings continuous', () => {
    const rows = [
      { box_type_code: 'WHOLE CORE', box_top_ft: 0, box_bottom_ft: 20 },
      { box_type_code: 'WHOLE CORE', box_top_ft: 20, box_bottom_ft: 40 },
      { box_type_code: 'SLABS', box_top_ft: 1000, box_bottom_ft: 1010 },
      { box_type_code: 'CUTTINGS', box_top_ft: 0, box_bottom_ft: 500 },
      { box_type_code: 'CUTTINGS', box_top_ft: 500, box_bottom_ft: 1000 },
    ]

    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
      { sample_type: 'Core', top_ft: 1000, bottom_ft: 1010 },
      { sample_type: 'Cuttings', top_ft: 0, bottom_ft: 1000 },
    ])
  })

  it('buckets different raw box_type_code values into the same Core group before merging', () => {
    // "WHOLE CORE" and "SLABS" are different raw box_type_code values but the same group —
    // grouping happens via the STAC by-boxtype legend (resolveSampleTypeGroupBy), not the
    // broken box_type_group column.
    const rows = [
      { box_type_code: 'WHOLE CORE', box_top_ft: 0, box_bottom_ft: 20 },
      { box_type_code: 'SLABS', box_top_ft: 20, box_bottom_ft: 40 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
    ])
  })

  it('merges adjacent samples when the gap is exactly at the threshold (<=10)', () => {
    const rows = [
      { box_type_code: 'WHOLE CORE', box_top_ft: 0, box_bottom_ft: 40 },
      { box_type_code: 'WHOLE CORE', box_top_ft: 50, box_bottom_ft: 60 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 60 },
    ])
  })

  it('splits into a new interval once the gap exceeds the threshold', () => {
    const rows = [
      { box_type_code: 'WHOLE CORE', box_top_ft: 0, box_bottom_ft: 40 },
      { box_type_code: 'WHOLE CORE', box_top_ft: 51, box_bottom_ft: 60 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
      { sample_type: 'Core', top_ft: 51, bottom_ft: 60 },
    ])
  })

  it('handles unsorted input and overlapping/out-of-order top-bottom values', () => {
    const rows = [
      { box_type_code: 'WHOLE CORE', box_top_ft: 40, box_bottom_ft: 20 }, // reversed
      { box_type_code: 'WHOLE CORE', box_top_ft: 0, box_bottom_ft: 20 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
    ])
  })

  it('skips rows with missing/non-numeric top or bottom depths', () => {
    const rows = [
      { box_type_code: 'WHOLE CORE', box_top_ft: null, box_bottom_ft: 10 },
      { box_type_code: 'WHOLE CORE', box_top_ft: 0, box_bottom_ft: undefined },
      { box_type_code: 'WHOLE CORE', box_top_ft: 'n/a', box_bottom_ft: 10 },
      { box_type_code: 'WHOLE CORE', box_top_ft: '   ', box_bottom_ft: 10 },
      { box_type_code: 'WHOLE CORE', box_top_ft: 5, box_bottom_ft: 15 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 5, bottom_ft: 15 },
    ])
  })

  it('skips rows with no usable type value', () => {
    const rows = [{ box_type_code: '', box_top_ft: 0, box_bottom_ft: 10 }]
    expect(mergeSampleIntervals(rows, opts)).toEqual([])
  })

  it('respects a custom maxGap', () => {
    const rows = [
      { box_type_code: 'WHOLE CORE', box_top_ft: 0, box_bottom_ft: 10 },
      { box_type_code: 'WHOLE CORE', box_top_ft: 15, box_bottom_ft: 20 },
    ]
    expect(mergeSampleIntervals(rows, { ...opts, maxGap: 2 })).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 10 },
      { sample_type: 'Core', top_ft: 15, bottom_ft: 20 },
    ])
    expect(mergeSampleIntervals(rows, { ...opts, maxGap: 10 })).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 20 },
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(mergeSampleIntervals([], opts)).toEqual([])
  })

  it('uses the raw type value as-is when no groupBy is provided', () => {
    const rows = [{ box_type_code: 'WHOLE CORE', box_top_ft: 0, box_bottom_ft: 10 }]
    const { groupBy: _groupBy, ...rest } = opts
    expect(mergeSampleIntervals(rows, rest)).toEqual([
      { sample_type: 'WHOLE CORE', top_ft: 0, bottom_ft: 10 },
    ])
  })

  describe('notes roll-up', () => {
    const notesOpts = { ...opts, notesField: 'notes_public' }

    it('includes notes_public when a single contributing row has a note', () => {
      const rows = [
        {
          box_type_code: 'WHOLE CORE',
          box_top_ft: 0,
          box_bottom_ft: 10,
          notes_public: 'Fractured interval',
        },
      ]
      expect(mergeSampleIntervals(rows, notesOpts)).toEqual([
        {
          sample_type: 'Core',
          top_ft: 0,
          bottom_ft: 10,
          notes_public: 'Fractured interval',
        },
      ])
    })

    it('omits notes_public entirely when no contributing row has a note', () => {
      const rows = [
        {
          box_type_code: 'WHOLE CORE',
          box_top_ft: 0,
          box_bottom_ft: 10,
          notes_public: '',
        },
        {
          box_type_code: 'WHOLE CORE',
          box_top_ft: 10,
          box_bottom_ft: 20,
          notes_public: null,
        },
      ]
      const result = mergeSampleIntervals(rows, notesOpts)
      expect(result).toEqual([
        { sample_type: 'Core', top_ft: 0, bottom_ft: 20 },
      ])
      expect(result[0]).not.toHaveProperty('notes_public')
    })

    it('dedupes and joins distinct notes from multiple merged rows', () => {
      const rows = [
        {
          box_type_code: 'WHOLE CORE',
          box_top_ft: 0,
          box_bottom_ft: 10,
          notes_public: 'Note A',
        },
        {
          box_type_code: 'SLABS',
          box_top_ft: 10,
          box_bottom_ft: 20,
          notes_public: 'Note B',
        },
        {
          box_type_code: 'WHOLE CORE',
          box_top_ft: 20,
          box_bottom_ft: 30,
          notes_public: 'Note A',
        },
      ]
      expect(mergeSampleIntervals(rows, notesOpts)).toEqual([
        {
          sample_type: 'Core',
          top_ft: 0,
          bottom_ft: 30,
          notes_public: 'Note A; Note B',
        },
      ])
    })

    it('does not roll up notes when notesField is omitted', () => {
      const rows = [
        {
          box_type_code: 'WHOLE CORE',
          box_top_ft: 0,
          box_bottom_ft: 10,
          notes_public: 'Should be ignored',
        },
      ]
      const result = mergeSampleIntervals(rows, opts)
      expect(result[0]).not.toHaveProperty('notes_public')
    })
  })
})
