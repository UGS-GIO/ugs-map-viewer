// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toGeoJSON, downloadCSV, downloadGeoJSON } from '../download-utils';

// ── toGeoJSON ─────────────────────────────────────────────────────────

describe('toGeoJSON', () => {
  it('creates FeatureCollection with geometry and properties separated', () => {
    const data = [
      { name: 'A', geometry: { type: 'Point', coordinates: [-111, 40] } },
    ];
    const result = toGeoJSON(data);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features[0].geometry).toEqual({ type: 'Point', coordinates: [-111, 40] });
    expect(result.features[0].properties).toEqual({ name: 'A' });
    expect(result.features[0].properties).not.toHaveProperty('geometry');
  });

  it('auto-detects lat/lng columns', () => {
    const result = toGeoJSON([{ name: 'A', latitude: 40.76, longitude: -111.09 }]);
    expect(result.features[0].geometry).toEqual({
      type: 'Point', coordinates: [-111.09, 40.76],
    });
  });

  it('uses custom geometryKey option', () => {
    const result = toGeoJSON(
      [{ name: 'A', geom: { type: 'Point', coordinates: [-111, 40] } }],
      { geometryKey: 'geom' }
    );
    expect(result.features[0].geometry).toEqual({ type: 'Point', coordinates: [-111, 40] });
  });

  it('sets geometry to null when no source found', () => {
    expect(toGeoJSON([{ name: 'A' }]).features[0].geometry).toBeNull();
  });

  it('uses ogc_fid as feature id, falls back to index', () => {
    expect(toGeoJSON([{ ogc_fid: 123 }]).features[0].id).toBe(123);
    expect(toGeoJSON([{ name: 'A' }]).features[0].id).toBe(0);
  });

  it('excludes underscore-prefixed internal fields from properties', () => {
    const result = toGeoJSON([{ name: 'A', _internal: 'hidden' }]);
    expect(result.features[0].properties).not.toHaveProperty('_internal');
  });
});

// ── downloadCSV ─────────────────────────────────────────────────────────

describe('downloadCSV', () => {
  let blobContent: string;
  let clickedDownload: string;

  beforeEach(() => {
    blobContent = '';
    clickedDownload = '';

    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = originalCreateElement('a');
        a.click = vi.fn(() => { clickedDownload = a.download; });
        return a;
      }
      return originalCreateElement(tag);
    });

    const OriginalBlob = globalThis.Blob;
    globalThis.Blob = class CaptureBlob extends OriginalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        if (parts) blobContent = parts.map(p => String(p)).join('');
      }
    };
  });

  it('generates CSV with headers and rows', () => {
    downloadCSV(
      [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }],
      'test', ['Name', 'Age'],
      (row, header) => header === 'Name' ? row.name : row.age
    );
    expect(blobContent).toBe('Name,Age\nAlice,30\nBob,25');
  });

  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    downloadCSV([{ v: 'a, b' }], 't', ['V'], (row) => row.v);
    expect(blobContent).toBe('V\n"a, b"');

    downloadCSV([{ v: 'say "hi"' }], 't', ['V'], (row) => row.v);
    expect(blobContent).toBe('V\n"say ""hi"""');
  });

  it('handles null values and appends .csv extension', () => {
    downloadCSV([{ v: null }], 'export', ['V'], (row) => row.v);
    expect(blobContent).toBe('V\n');
    expect(clickedDownload).toBe('export.csv');
  });
});

// ── downloadGeoJSON ─────────────────────────────────────────────────────

describe('downloadGeoJSON', () => {
  let clickedDownload: string;

  beforeEach(() => {
    clickedDownload = '';
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = originalCreateElement('a');
        a.click = vi.fn(() => { clickedDownload = a.download; });
        return a;
      }
      return originalCreateElement(tag);
    });
  });

  it('appends .geojson extension', () => {
    downloadGeoJSON([{ name: 'A', geometry: { type: 'Point', coordinates: [0, 0] } }], 'export');
    expect(clickedDownload).toBe('export.geojson');
  });
});
