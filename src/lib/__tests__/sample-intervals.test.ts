import { describe, it, expect } from 'vitest';
import { mergeSampleIntervals } from '../sample-intervals';

const opts = {
  typeField: 'box_type_group',
  typeFallbackField: 'box_type',
  topField: 'box_top_ft',
  bottomField: 'box_bottom_ft',
};

describe('mergeSampleIntervals', () => {
  it('matches the ALL-4766 example: splits Core on a >10 gap, keeps Cuttings continuous', () => {
    const rows = [
      { box_type_group: 'Core', box_top_ft: 0, box_bottom_ft: 20 },
      { box_type_group: 'Core', box_top_ft: 20, box_bottom_ft: 40 },
      { box_type_group: 'Core', box_top_ft: 1000, box_bottom_ft: 1010 },
      { box_type_group: 'Cuttings', box_top_ft: 0, box_bottom_ft: 500 },
      { box_type_group: 'Cuttings', box_top_ft: 500, box_bottom_ft: 1000 },
    ];

    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
      { sample_type: 'Core', top_ft: 1000, bottom_ft: 1010 },
      { sample_type: 'Cuttings', top_ft: 0, bottom_ft: 1000 },
    ]);
  });

  it('merges adjacent samples when the gap is exactly at the threshold (<=10)', () => {
    const rows = [
      { box_type_group: 'Core', box_top_ft: 0, box_bottom_ft: 40 },
      { box_type_group: 'Core', box_top_ft: 50, box_bottom_ft: 60 },
    ];
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 60 },
    ]);
  });

  it('splits into a new interval once the gap exceeds the threshold', () => {
    const rows = [
      { box_type_group: 'Core', box_top_ft: 0, box_bottom_ft: 40 },
      { box_type_group: 'Core', box_top_ft: 51, box_bottom_ft: 60 },
    ];
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
      { sample_type: 'Core', top_ft: 51, bottom_ft: 60 },
    ]);
  });

  it('handles unsorted input and overlapping/out-of-order top-bottom values', () => {
    const rows = [
      { box_type_group: 'Core', box_top_ft: 40, box_bottom_ft: 20 }, // reversed
      { box_type_group: 'Core', box_top_ft: 0, box_bottom_ft: 20 },
    ];
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 40 },
    ]);
  });

  it('falls back to box_type when box_type_group is missing', () => {
    const rows = [
      { box_type: 'Whole Core', box_top_ft: 0, box_bottom_ft: 10 },
    ];
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Whole Core', top_ft: 0, bottom_ft: 10 },
    ]);
  });

  it('skips rows with missing/non-numeric top or bottom depths', () => {
    const rows = [
      { box_type_group: 'Core', box_top_ft: null, box_bottom_ft: 10 },
      { box_type_group: 'Core', box_top_ft: 0, box_bottom_ft: undefined },
      { box_type_group: 'Core', box_top_ft: 'n/a', box_bottom_ft: 10 },
      { box_type_group: 'Core', box_top_ft: 5, box_bottom_ft: 15 },
    ];
    expect(mergeSampleIntervals(rows, opts)).toEqual([
      { sample_type: 'Core', top_ft: 5, bottom_ft: 15 },
    ]);
  });

  it('skips rows with no usable type value', () => {
    const rows = [
      { box_type_group: '', box_type: '', box_top_ft: 0, box_bottom_ft: 10 },
    ];
    expect(mergeSampleIntervals(rows, opts)).toEqual([]);
  });

  it('respects a custom maxGap', () => {
    const rows = [
      { box_type_group: 'Core', box_top_ft: 0, box_bottom_ft: 10 },
      { box_type_group: 'Core', box_top_ft: 15, box_bottom_ft: 20 },
    ];
    expect(mergeSampleIntervals(rows, { ...opts, maxGap: 2 })).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 10 },
      { sample_type: 'Core', top_ft: 15, bottom_ft: 20 },
    ]);
    expect(mergeSampleIntervals(rows, { ...opts, maxGap: 10 })).toEqual([
      { sample_type: 'Core', top_ft: 0, bottom_ft: 20 },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(mergeSampleIntervals([], opts)).toEqual([]);
  });
});
