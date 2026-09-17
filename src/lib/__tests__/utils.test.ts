import { describe, it, expect } from 'vitest';
import { formatNumeric, toTitleCase, toSentenceCase, isSafeHref } from '../utils';

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

describe('isSafeHref', () => {
    it('allows http(s) links', () => {
        expect(isSafeHref('https://maps.geology.utah.gov/subsurface?lat=39')).toBe(true)
        expect(isSafeHref('http://example.org')).toBe(true)
    })

    it('allows same-origin paths', () => {
        expect(isSafeHref('/subsurface?zoom=12')).toBe(true)
    })

    it('rejects script and data URLs, however they are spelled', () => {
        expect(isSafeHref('javascript:alert(1)')).toBe(false)
        expect(isSafeHref('  JavaScript:alert(1)')).toBe(false)
        expect(isSafeHref('data:text/html,<script>alert(1)</script>')).toBe(false)
        expect(isSafeHref('vbscript:msgbox(1)')).toBe(false)
    })

    it('rejects protocol-relative links, which inherit whatever scheme the page has', () => {
        expect(isSafeHref('//evil.example')).toBe(false)
    })

    it('rejects an empty or unparseable value', () => {
        expect(isSafeHref('')).toBe(false)
    })
})
