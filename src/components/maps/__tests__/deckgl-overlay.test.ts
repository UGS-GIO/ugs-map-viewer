import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PickingInfo } from '@deck.gl/core';
import type { ParquetLayerProps } from '@/lib/types/mapping-types';

/** A pick's index is an index into the drawn slice, not the table. Getting that
 *  mapping wrong shows a real popup full of the wrong feature's values. */

const rowQueries: Array<{ attrTable: string; rowIds: number[] }> = [];
vi.mock('@/lib/map/user-layers/parquet-deck-loader', () => ({
    queryParquetRowProperties: vi.fn(async (attrTable: string, rowIds: number[]) => {
        rowQueries.push({ attrTable, rowIds });
        if (attrTable === 'broken') throw new Error('table dropped');
        return new Map(rowIds.map(id => [id, { name: `row-${id}` }]));
    }),
    queryPointsInViewport: vi.fn(),
}));

import { pickParquetPoints, hydrateParquetPointHits, getDeckLayerId } from '@/components/maps/deckgl-overlay';

/** A Parquet point layer with the DuckDB handles the pipeline reads. */
function layer(title: string, attrTable = `${title}_attrs`): ParquetLayerProps {
    return {
        type: 'parquet',
        title,
        parquetUrl: `https://x.org/${title}.parquet`,
        deckData: { kind: 'points', points: { count: 3 }, pointTable: `${title}_pts`, attrTable },
        visible: true,
    };
}

/** A slice as the overlay hangs it off the Deck layer. */
function view(rowIds: number[], coords: number[]) {
    return {
        positions: Float32Array.from(coords),
        rowIds: Int32Array.from(rowIds),
        count: rowIds.length,
        inView: rowIds.length,
        stride: 1,
    };
}

function pick(layerTitle: string, index: number, slice: ReturnType<typeof view>): PickingInfo {
    const info = {
        index,
        layer: { id: getDeckLayerId(layer(layerTitle)), props: { ugsPointView: slice } },
    };
    // `PickingInfo` carries far more than picking actually uses here.
    return info as unknown as PickingInfo;
}

function picker(picks: PickingInfo[]) {
    return { pickMultipleObjects: () => picks };
}

beforeEach(() => { rowQueries.length = 0; });

describe('pickParquetPoints', () => {
    it('resolves a pick index to the row id the slice was built from', () => {
        const slice = view([10, 41, 77], [-111, 40, -112, 41, -113, 42]);
        const hits = pickParquetPoints(picker([pick('wells', 1, slice)]), { x: 5, y: 5 }, 4, [layer('wells')]);

        // Index 1 in a thinned slice is row 41, not row 1.
        expect(hits).toHaveLength(1);
        expect(hits[0].rowId).toBe(41);
        expect(hits[0].lng).toBeCloseTo(-112, 4);
        expect(hits[0].lat).toBeCloseTo(41, 4);
    });

    it('returns one hit per layer, even when Deck drills through several points', () => {
        const slice = view([1, 2], [0, 0, 1, 1]);
        const hits = pickParquetPoints(
            picker([pick('wells', 0, slice), pick('wells', 1, slice)]),
            { x: 5, y: 5 }, 4, [layer('wells')],
        );
        expect(hits).toHaveLength(1);
        expect(hits[0].rowId).toBe(1);
    });

    it('keeps a hit from each layer under the cursor', () => {
        const a = view([5], [0, 0]);
        const b = view([9], [1, 1]);
        const hits = pickParquetPoints(
            picker([pick('wells', 0, a), pick('cores', 0, b)]),
            { x: 5, y: 5 }, 4, [layer('wells'), layer('cores')],
        );
        expect(hits.map(h => h.layer.title)).toEqual(['wells', 'cores']);
        expect(hits.map(h => h.rowId)).toEqual([5, 9]);
    });

    it('ignores an index past the end of the slice rather than reading garbage', () => {
        const slice = view([1], [0, 0]);
        expect(pickParquetPoints(picker([pick('wells', 7, slice)]), { x: 1, y: 1 }, 4, [layer('wells')])).toEqual([]);
    });

    it('ignores a miss, which Deck reports as index -1', () => {
        const slice = view([1], [0, 0]);
        expect(pickParquetPoints(picker([pick('wells', -1, slice)]), { x: 1, y: 1 }, 4, [layer('wells')])).toEqual([]);
    });

    it('ignores a layer that is not carrying a slice yet', () => {
        const info = { index: 0, layer: { id: getDeckLayerId(layer('wells')), props: {} } } as unknown as PickingInfo;
        expect(pickParquetPoints(picker([info]), { x: 1, y: 1 }, 4, [layer('wells')])).toEqual([]);
    });

    it('picks nothing when there is no overlay or no layers', () => {
        expect(pickParquetPoints(null, { x: 1, y: 1 }, 4, [layer('wells')])).toEqual([]);
        expect(pickParquetPoints(picker([]), { x: 1, y: 1 }, 4, [])).toEqual([]);
    });

    it('survives a picker that throws, so a lost GL context cannot break a click', () => {
        const thrower = { pickMultipleObjects: () => { throw new Error('context lost'); } };
        expect(pickParquetPoints(thrower, { x: 1, y: 1 }, 4, [layer('wells')])).toEqual([]);
    });
});

describe('hydrateParquetPointHits', () => {
    it('reads each layer’s rows in one query', async () => {
        const slice = view([3, 4], [0, 0, 1, 1]);
        const hits = [
            ...pickParquetPoints(picker([pick('wells', 0, slice)]), { x: 1, y: 1 }, 4, [layer('wells')]),
            ...pickParquetPoints(picker([pick('cores', 1, slice)]), { x: 1, y: 1 }, 4, [layer('cores')]),
        ];
        const features = await hydrateParquetPointHits(hits);

        expect(rowQueries).toHaveLength(2);
        expect(features.map(f => f.layerTitle).sort()).toEqual(['cores', 'wells']);
        expect(features.find(f => f.layerTitle === 'wells')?.properties).toEqual({ name: 'row-3' });
    });

    it('carries the picked coordinates onto the feature', async () => {
        const slice = view([3], [-111.5, 40.2]);
        const features = await hydrateParquetPointHits(
            pickParquetPoints(picker([pick('wells', 0, slice)]), { x: 1, y: 1 }, 4, [layer('wells')]),
        );
        expect(features[0].geometry).toMatchObject({ type: 'Point' });
    });

    it('still yields the feature when the attribute lookup fails', async () => {
        const slice = view([3], [0, 0]);
        const hits = pickParquetPoints(
            picker([pick('wells', 0, slice)]), { x: 1, y: 1 }, 4, [layer('wells', 'broken')],
        );
        const features = await hydrateParquetPointHits(hits);
        expect(features).toHaveLength(1);
        expect(features[0].properties).toEqual({});
    });

    it('does nothing for an empty pick', async () => {
        await expect(hydrateParquetPointHits([])).resolves.toEqual([]);
        expect(rowQueries).toEqual([]);
    });
});
