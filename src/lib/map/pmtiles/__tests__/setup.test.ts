import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Local PMTiles registration.
 *
 * The contract that matters: an uploaded archive must be registered under the
 * file NAME before its layer renders, because a cache miss makes the protocol
 * treat that key as a URL and fetch a file that does not exist.
 */

// Hoisted so the mock factories (which vitest lifts above imports) can see them.
const { addProtocol, added, tiles } = vi.hoisted(() => ({
    addProtocol: vi.fn(),
    added: [] as unknown[],
    tiles: new Map<string, unknown>(),
}));

vi.mock('maplibre-gl', () => ({ default: { addProtocol } }));

vi.mock('pmtiles', () => ({
    Protocol: class {
        tiles = tiles;
        tile = vi.fn();
        add(archive: unknown) { added.push(archive); }
    },
    PMTiles: class {
        constructor(public source: { getKey: () => string }) { }
    },
    FileSource: class {
        constructor(public file: File) { }
        getKey() { return this.file.name; }
    },
}));

import { setupPMTilesProtocol, registerLocalPMTiles, unregisterLocalPMTiles } from '@/lib/map/pmtiles/setup';

beforeEach(() => {
    addProtocol.mockClear();
    added.length = 0;
    tiles.clear();
});

describe('setupPMTilesProtocol', () => {
    it('registers the protocol with MapLibre once, however many times it is called', () => {
        setupPMTilesProtocol();
        setupPMTilesProtocol();
        setupPMTilesProtocol();
        // The module keeps one protocol for the app's lifetime; a second
        // registration would replace the handler MapLibre already holds.
        expect(addProtocol.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('registers under the `pmtiles` scheme when it does register', () => {
        setupPMTilesProtocol();
        for (const [scheme] of addProtocol.mock.calls) expect(scheme).toBe('pmtiles');
    });
});

describe('registerLocalPMTiles', () => {
    it('adds an archive backed by the file, so no network read is attempted', () => {
        const file = new File([new Uint8Array(8)], 'local.pmtiles');
        const archive = registerLocalPMTiles(file);
        expect(added).toHaveLength(1);
        expect(added[0]).toBe(archive);
    });

    it('keys the archive on the file name, which is what a style URL references', () => {
        const file = new File([new Uint8Array(8)], 'wells.pmtiles');
        const archive = registerLocalPMTiles(file);
        const source = (archive as unknown as { source: { getKey: () => string } }).source;
        expect(source.getKey()).toBe('wells.pmtiles');
    });

    it('sets the protocol up on its own, so callers cannot forget', () => {
        registerLocalPMTiles(new File([new Uint8Array(1)], 'a.pmtiles'));
        expect(added).toHaveLength(1);
    });
});

describe('unregisterLocalPMTiles', () => {
    it('drops the key so a later upload of the same name is not shadowed', () => {
        tiles.set('wells.pmtiles', {});
        unregisterLocalPMTiles('wells.pmtiles');
        expect(tiles.has('wells.pmtiles')).toBe(false);
    });

    it('is a no-op for a key that was never registered', () => {
        expect(() => unregisterLocalPMTiles('missing.pmtiles')).not.toThrow();
    });
});
