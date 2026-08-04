import { describe, it, expect } from 'vitest'
import { mergeSampleIntervals, titleCaseGroup } from '../sample-intervals'

// The warehouse publishes `box_type_group` per box as an uppercase group code
// (BoxType.category on the UCRC app). The popup only display-cases it.
const opts = {
  typeField: 'box_type_group',
  groupBy: titleCaseGroup,
  topField: 'box_top_ft',
  bottomField: 'box_bottom_ft',
}

describe('titleCaseGroup', () => {
  it('title-cases the published group codes', () => {
    expect(titleCaseGroup('CORE')).toBe('Core')
    expect(titleCaseGroup('CUTTINGS')).toBe('Cuttings')
    expect(titleCaseGroup('OTHER')).toBe('Other')
  })

  it('is whitespace and case insensitive', () => {
    expect(titleCaseGroup('  core  ')).toBe('Core')
    expect(titleCaseGroup('CoRe')).toBe('Core')
  })

  it('cases every word, so a future multi-word group renders correctly', () => {
    expect(titleCaseGroup('WHOLE CORE')).toBe('Whole Core')
  })

  it('returns an empty string for empty/missing groups', () => {
    expect(titleCaseGroup('')).toBe('')
    expect(titleCaseGroup('   ')).toBe('')
    expect(titleCaseGroup(null)).toBe('')
    expect(titleCaseGroup(undefined)).toBe('')
  })
})

describe('mergeSampleIntervals', () => {
  it('matches the ALL-4766 example: splits Core on a >10 gap, keeps Cuttings continuous', () => {
    const rows = [
      { box_type_group: 'CORE', box_top_ft: 0, box_bottom_ft: 20 },
      { box_type_group: 'CORE', box_top_ft: 20, box_bottom_ft: 40 },
      { box_type_group: 'CORE', box_top_ft: 1000, box_bottom_ft: 1010 },
      { box_type_group: 'CUTTINGS', box_top_ft: 0, box_bottom_ft: 500 },
      { box_type_group: 'CUTTINGS', box_top_ft: 500, box_bottom_ft: 1000 },
    ]

    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
      { sample_type: 'Core', top_ft: 1000, bottom_ft: 1010 },
      { sample_type: 'Cuttings', top_ft: 0, bottom_ft: 1000 },
    ])
  })

  it('merges rows into one bucket regardless of the published group casing', () => {
    // Distinct box types (WHOLE CORE, SLABS, ...) already arrive collapsed to one
    // `box_type_group` upstream; groupBy only normalizes casing on the way in.
    const rows = [
      { box_type_group: 'CORE', box_top_ft: 0, box_bottom_ft: 20 },
      { box_type_group: 'core', box_top_ft: 20, box_bottom_ft: 40 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
    ])
  })

  it('merges adjacent samples when the gap is exactly at the threshold (<=10)', () => {
    const rows = [
      { box_type_group: 'CORE', box_top_ft: 0, box_bottom_ft: 40 },
      { box_type_group: 'CORE', box_top_ft: 50, box_bottom_ft: 60 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 60 },
    ])
  })

  it('splits into a new interval once the gap exceeds the threshold', () => {
    const rows = [
      { box_type_group: 'CORE', box_top_ft: 0, box_bottom_ft: 40 },
      { box_type_group: 'CORE', box_top_ft: 51, box_bottom_ft: 60 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
      { sample_type: 'Core', top_ft: 51, bottom_ft: 60 },
    ])
  })

  it('handles unsorted input and overlapping/out-of-order top-bottom values', () => {
    const rows = [
      { box_type_group: 'CORE', box_top_ft: 40, box_bottom_ft: 20 }, // reversed
      { box_type_group: 'CORE', box_top_ft: 0, box_bottom_ft: 20 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
    ])
  })

  it('skips rows with missing/non-numeric top or bottom depths', () => {
    const rows = [
      { box_type_group: 'CORE', box_top_ft: null, box_bottom_ft: 10 },
      { box_type_group: 'CORE', box_top_ft: 0, box_bottom_ft: undefined },
      { box_type_group: 'CORE', box_top_ft: 'n/a', box_bottom_ft: 10 },
      { box_type_group: 'CORE', box_top_ft: '   ', box_bottom_ft: 10 },
      { box_type_group: 'CORE', box_top_ft: 5, box_bottom_ft: 15 },
    ]
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 5, bottom_ft: 15 },
    ])
  })

  it('skips rows with no usable type value', () => {
    const rows = [{ box_type_group: '', box_top_ft: 0, box_bottom_ft: 10 }]
    expect(mergeSampleIntervals(rows, opts)).toEqual([])
  })

  it('respects a custom maxGap', () => {
    const rows = [
      { box_type_group: 'CORE', box_top_ft: 0, box_bottom_ft: 10 },
      { box_type_group: 'CORE', box_top_ft: 15, box_bottom_ft: 20 },
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
    const rows = [{ box_type_group: 'CORE', box_top_ft: 0, box_bottom_ft: 10 }]
    const { groupBy: _groupBy, ...rest } = opts
    expect(mergeSampleIntervals(rows, rest)).toEqual([
      { sample_type: 'CORE', top_ft: 0, bottom_ft: 10 },
    ])
  })

  describe('notes roll-up', () => {
    const notesOpts = { ...opts, notesField: 'notes_public' }

    it('includes notes_public when a single contributing row has a note', () => {
      const rows = [
        {
          box_type_group: 'CORE',
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
          box_type_group: 'CORE',
          box_top_ft: 0,
          box_bottom_ft: 10,
          notes_public: '',
        },
        {
          box_type_group: 'CORE',
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
          box_type_group: 'CORE',
          box_top_ft: 0,
          box_bottom_ft: 10,
          notes_public: 'Note A',
        },
        {
          box_type_group: 'CORE',
          box_top_ft: 10,
          box_bottom_ft: 20,
          notes_public: 'Note B',
        },
        {
          box_type_group: 'CORE',
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
          box_type_group: 'CORE',
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
