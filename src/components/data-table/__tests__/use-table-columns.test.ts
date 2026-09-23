import { describe, it, expect } from 'vitest'
import { resolveColumnSort } from '../use-table-columns'
import type { FieldConfig } from '@/lib/types/mapping-types'

// The results table sorts columns by their field. string/number/date sort by
// their own value; a custom column (transform-rendered string) is unsortable
// unless it declares `sortField` — a real numeric property to order by. This
// pins that derivation, especially the InSAR range column that regressed to
// unsortable when it moved from `number` to `custom`.
describe('resolveColumnSort', () => {
    it('sorts a string column alphanumerically by its own field', () => {
        expect(resolveColumnSort({ field: 'location', type: 'string' }, 'location'))
            .toEqual({ enabled: true, sortKey: 'location', numeric: false })
    })

    it('sorts a number column numerically by its own field', () => {
        expect(resolveColumnSort({ field: 'depth', type: 'number' }, 'depth'))
            .toEqual({ enabled: true, sortKey: 'depth', numeric: true })
    })

    it('leaves a custom column unsortable by default', () => {
        expect(resolveColumnSort({ field: 'value_inches_min', type: 'custom' }, 'value_inches_min'))
            .toEqual({ enabled: false, sortKey: 'value_inches_min', numeric: false })
    })

    it('makes a custom column sort numerically when it declares sortField', () => {
        // The displacement range column: cell is a formatted range string, but it
        // sorts by the deep-edge value so the one quantitative column stays sortable.
        expect(resolveColumnSort(
            { field: 'value_inches_min', type: 'custom', sortField: 'value_inches_min' },
            'value_inches_min',
        )).toEqual({ enabled: true, sortKey: 'value_inches_min', numeric: true })
    })

    it('can sort a custom column by a different property than it displays', () => {
        expect(resolveColumnSort(
            { field: 'range_label', type: 'custom', sortField: 'depth_in' },
            'range_label',
        )).toEqual({ enabled: true, sortKey: 'depth_in', numeric: true })
    })

    it('honors an explicit sortable:false even when sortField is set', () => {
        const cfg: FieldConfig = { field: 'value_inches_min', type: 'custom', sortField: 'value_inches_min', sortable: false }
        expect(resolveColumnSort(cfg, 'value_inches_min').enabled).toBe(false)
    })

    it('defaults to sorting by the given field when there is no config', () => {
        expect(resolveColumnSort(undefined, 'anything'))
            .toEqual({ enabled: true, sortKey: 'anything', numeric: false })
    })
})
