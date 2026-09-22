import { describe, it, expect } from 'vitest';
import { resolveDefaultSourceIndex, getDisplayValue, getSourceDisplayName } from '../search-utils';
import type { SearchSourceConfig, ParquetSearchConfig } from '../search-types';

const source = (sourceName: string): SearchSourceConfig => ({
    type: 'postgREST',
    url: `https://example.com/${sourceName}`,
    sourceName,
    displayField: 'name',
});

const config: SearchSourceConfig[] = [
    source('UCRC Collection'),
    source('Address or City Search'),
    source('Wells Database'),
];

describe('resolveDefaultSourceIndex', () => {
    it('returns null when no default name is given', () => {
        expect(resolveDefaultSourceIndex(config, undefined)).toBeNull();
    });

    it('returns null for an empty default name', () => {
        expect(resolveDefaultSourceIndex(config, '')).toBeNull();
    });

    it('returns the index of the source whose display name matches', () => {
        expect(resolveDefaultSourceIndex(config, 'UCRC Collection')).toBe(0);
        expect(resolveDefaultSourceIndex(config, 'Wells Database')).toBe(2);
    });

    it('returns null when no source matches the name', () => {
        expect(resolveDefaultSourceIndex(config, 'Nonexistent Source')).toBeNull();
    });

    it('returns null for an empty config', () => {
        expect(resolveDefaultSourceIndex([], 'UCRC Collection')).toBeNull();
    });

    it('tracks the source by name, not position, after a reorder', () => {
        const reordered = [config[2], config[0], config[1]];
        expect(resolveDefaultSourceIndex(reordered, 'UCRC Collection')).toBe(1);
    });
});

describe('getDisplayValue for parquet source', () => {
    it('formats display value for section search', () => {
        const parquetConfig: ParquetSearchConfig = {
            type: 'parquet',
            parquetUrl: 'https://example.com/enmin_plss_sections.parquet',
            displayField: 'label',
            secondaryDisplayField: 'section',
        };
        const properties = { label: 'T43S R11W', section: '31' };
        expect(getDisplayValue(properties, parquetConfig)).toBe('T43S R11W — Sec 31');
    });
});

describe('getSourceDisplayName for parquet source', () => {
    it('uses sourceName if present', () => {
        const parquetConfig: ParquetSearchConfig = {
            type: 'parquet',
            parquetUrl: 'https://example.com/enmin_plss_sections.parquet',
            sourceName: 'Utah Township, Range & Section',
            displayField: 'label',
        };
        expect(getSourceDisplayName(parquetConfig)).toBe('Utah Township, Range & Section');
    });
});
