import { describe, it, expect } from 'vitest'
import { mergeSampleIntervals, boxTypeToSampleGroup } from '../sample-intervals'

const opts = {
  typeField: 'box_type',
  groupBy: boxTypeToSampleGroup,
  topField: 'box_top_ft',
  bottomField: 'box_bottom_ft',
}

describe('boxTypeToSampleGroup', () => {
  it('buckets known Core box types (case/whitespace insensitive)', () => {
    expect(boxTypeToSampleGroup('Whole Core')).toBe('Core')
    expect(boxTypeToSampleGroup('whole core')).toBe('Core')
    expect(boxTypeToSampleGroup('  BUTTS  ')).toBe('Core')
    expect(boxTypeToSampleGroup('Slabs')).toBe('Core')
    expect(boxTypeToSampleGroup('Spot Cores')).toBe('Core')
    expect(boxTypeToSampleGroup('Skeletonized Core')).toBe('Core')
    expect(boxTypeToSampleGroup('Core Samples')).toBe('Core')
  })

  it('buckets known Cuttings box types', () => {
    expect(boxTypeToSampleGroup('Cuttings')).toBe('Cuttings')
    expect(boxTypeToSampleGroup('Core Chips')).toBe('Cuttings')
  })

  it('buckets unrecognized non-empty types as Other', () => {
    expect(boxTypeToSampleGroup('Outcrop Samples')).toBe('Other')
    expect(boxTypeToSampleGroup('Sidewall Plugs')).toBe('Other')
    expect(boxTypeToSampleGroup('Thin Sections')).toBe('Other')
    expect(boxTypeToSampleGroup('Unknown')).toBe('Other')
    expect(boxTypeToSampleGroup('something new')).toBe('Other')
  })

  it('returns an empty string for empty/missing types', () => {
    expect(boxTypeToSampleGroup('')).toBe('')
    expect(boxTypeToSampleGroup(null)).toBe('')
    expect(boxTypeToSampleGroup(undefined)).toBe('')
  })
})

describe('mergeSampleIntervals', () => {
  it('matches the ALL-4766 example: splits Core on a >10 gap, keeps Cuttings continuous', () => {
    const rows = [
      { box_type: 'Whole Core', box_top_ft: 0, box_bottom_ft: 20 },
      { box_type: 'Whole Core', box_top_ft: 20, box_bottom_ft: 40 },
      { box_type: 'Slabs', box_top_ft: 1000, box_bottom_ft: 1010 },
      { box_type: 'Cuttings', box_top_ft: 0, box_bottom_ft: 500 },
      { box_type: 'Cuttings', box_top_ft: 500, box_bottom_ft: 1000 },
    ]

    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
      { sample_type: 'Core', top_ft: 1000, bottom_ft: 1010 },
      { sample_type: 'Cuttings', top_ft: 0, bottom_ft: 1000 },
    ])
  })

  it('buckets different raw box_type values into the same Core group before merging', () => {
    // "Whole Core" and "Slabs" are different raw box_type values but the same group —
    // this is the exact bug fix: box_type_group doesn't exist on the published data, so
    // grouping must happen via boxTypeToSampleGroup over the raw box_type values.
    const rows = [
      { box_type: 'Whole Core', box_top_ft: 0, box_bottom_ft: 20 },
      { box_type: 'Slabs', box_top_ft: 20, box_bottom_ft: 40 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
    ])
  })

  it('merges adjacent samples when the gap is exactly at the threshold (<=10)', () => {
    const rows = [
      { box_type: 'Whole Core', box_top_ft: 0, box_bottom_ft: 40 },
      { box_type: 'Whole Core', box_top_ft: 50, box_bottom_ft: 60 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 60 },
    ])
  })

  it('splits into a new interval once the gap exceeds the threshold', () => {
    const rows = [
      { box_type: 'Whole Core', box_top_ft: 0, box_bottom_ft: 40 },
      { box_type: 'Whole Core', box_top_ft: 51, box_bottom_ft: 60 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
      { sample_type: 'Core', top_ft: 51, bottom_ft: 60 },
    ])
  })

  it('handles unsorted input and overlapping/out-of-order top-bottom values', () => {
    const rows = [
      { box_type: 'Whole Core', box_top_ft: 40, box_bottom_ft: 20 }, // reversed
      { box_type: 'Whole Core', box_top_ft: 0, box_bottom_ft: 20 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
    ])
  })

  it('skips rows with missing/non-numeric top or bottom depths', () => {
    const rows = [
      { box_type: 'Whole Core', box_top_ft: null, box_bottom_ft: 10 },
      { box_type: 'Whole Core', box_top_ft: 0, box_bottom_ft: undefined },
      { box_type: 'Whole Core', box_top_ft: 'n/a', box_bottom_ft: 10 },
      { box_type: 'Whole Core', box_top_ft: '   ', box_bottom_ft: 10 },
      { box_type: 'Whole Core', box_top_ft: 5, box_bottom_ft: 15 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 5, bottom_ft: 15 },
    ])
  })

  it('skips rows with no usable type value', () => {
    const rows = [{ box_type: '', box_top_ft: 0, box_bottom_ft: 10 }]
    expect(mergeSampleIntervals(rows, opts)).toEqual([])
  })

  it('respects a custom maxGap', () => {
    const rows = [
      { box_type: 'Whole Core', box_top_ft: 0, box_bottom_ft: 10 },
      { box_type: 'Whole Core', box_top_ft: 15, box_bottom_ft: 20 },
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
    const rows = [{ box_type: 'Whole Core', box_top_ft: 0, box_bottom_ft: 10 }]
    const { groupBy: _groupBy, ...rest } = opts
    expect(mergeSampleIntervals(rows, rest)).toEqual([
      { sample_type: 'Whole Core', top_ft: 0, bottom_ft: 10 },
    ])
  })

  describe('notes roll-up', () => {
    const notesOpts = { ...opts, notesField: 'notes_public' }

    it('includes notes_public when a single contributing row has a note', () => {
      const rows = [
        {
          box_type: 'Whole Core',
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
          box_type: 'Whole Core',
          box_top_ft: 0,
          box_bottom_ft: 10,
          notes_public: '',
        },
        {
          box_type: 'Whole Core',
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
          box_type: 'Whole Core',
          box_top_ft: 0,
          box_bottom_ft: 10,
          notes_public: 'Note A',
        },
        {
          box_type: 'Slabs',
          box_top_ft: 10,
          box_bottom_ft: 20,
          notes_public: 'Note B',
        },
        {
          box_type: 'Whole Core',
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
          box_type: 'Whole Core',
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
