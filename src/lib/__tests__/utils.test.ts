import { describe, it, expect } from 'vitest';
import { formatNumeric, toTitleCase, toSentenceCase, hashString } from '../utils';

describe('formatNumeric', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(formatNumeric(null)).toBe('');
    expect(formatNumeric(undefined)).toBe('');
    expect(formatNumeric('')).toBe('');
  });

  it('formats numbers with locale-specific formatting', () => {
    expect(formatNumeric(1234567, 'number')).toBe('1,234,567');
    expect(formatNumeric(1234.5, 'currency')).toBe('$1,234.50');
    expect(formatNumeric(0.756, 'percent')).toBe('75.6%');
  });

  it('returns raw string for non-numeric input with format', () => {
    expect(formatNumeric('not a number', 'number')).toBe('not a number');
  });

  it('converts objects/arrays to JSON', () => {
    expect(formatNumeric({ a: 1 })).toBe('{"a":1}');
    expect(formatNumeric([1, 2])).toBe('[1,2]');
  });
});

describe('toTitleCase', () => {
  it('capitalizes first letter of each word', () => {
    expect(toTitleCase('hello world')).toBe('Hello World');
    expect(toTitleCase('HELLO')).toBe('Hello');
  });
});

describe('toSentenceCase', () => {
  it('capitalizes only the first letter', () => {
    expect(toSentenceCase('hello WORLD')).toBe('Hello world');
  });
});

describe('hashString', () => {
    it('is stable, so a layer keeps its colour and id across reloads', () => {
        expect(hashString('Municipalities')).toBe(hashString('Municipalities'));
    });

    it('separates titles that differ only in case or spacing', () => {
        expect(hashString('My Data')).not.toBe(hashString('my-data'));
        expect(hashString('a b')).not.toBe(hashString('ab'));
    });

    it('stays inside 32 unsigned bits, so `% palette.length` cannot go negative', () => {
        for (const s of ['', 'a', 'a very long user supplied layer title '.repeat(20), 'éèê']) {
            const h = hashString(s);
            expect(h).toBeGreaterThanOrEqual(0);
            expect(h).toBeLessThan(2 ** 32);
            expect(Number.isInteger(h)).toBe(true);
        }
    });

    it('hashes the empty string to zero rather than NaN', () => {
        expect(hashString('')).toBe(0);
    });
});
