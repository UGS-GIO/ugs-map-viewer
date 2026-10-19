import { describe, it, expect } from 'vitest';
import { formatNumeric, toTitleCase, toSentenceCase, isSafeHref, isHttpUrl } from '../utils';

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
    expect(isSafeHref('https://maps.geology.utah.gov/subsurface?lat=39')).toBe(true);
    expect(isSafeHref('http://example.org')).toBe(true);
  });

  it('allows same-origin paths', () => {
    expect(isSafeHref('/subsurface?zoom=12')).toBe(true);
  });

  it('rejects script and data URLs, however they are spelled', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('  JavaScript:alert(1)')).toBe(false);
    expect(isSafeHref('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHref('vbscript:msgbox(1)')).toBe(false);
  });

  it('rejects protocol-relative links, which inherit whatever scheme the page has', () => {
    expect(isSafeHref('//evil.example')).toBe(false);
  });

  it('rejects backslash paths, which browsers normalize into protocol-relative links', () => {
    expect(isSafeHref('/\\evil.example')).toBe(false);
    expect(isSafeHref('/\\\\evil.example')).toBe(false);
    expect(isSafeHref('/\\/evil.example')).toBe(false);
  });

  it('rejects tabs and newlines that browsers strip back into a protocol-relative link', () => {
    expect(isSafeHref('/\t/evil.example')).toBe(false);
    expect(isSafeHref('/\n/evil.example')).toBe(false);
    expect(isSafeHref('/\r/evil.example')).toBe(false);
    expect(isSafeHref('java\tscript:alert(1)')).toBe(false);
  });

  it('rejects an empty or unparseable value', () => {
    expect(isSafeHref('')).toBe(false);
  });
});

describe('isHttpUrl', () => {
  it('accepts valid http and https URLs', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
    expect(isHttpUrl('http://example.com/path?foo=bar#hash')).toBe(true);
    expect(isHttpUrl('https://doi.org/10.34191/RI-291')).toBe(true);
  });

  it('trims leading and trailing whitespace', () => {
    expect(isHttpUrl('   https://example.com   ')).toBe(true);
  });

  it('rejects non-http/https protocols', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,test')).toBe(false);
    expect(isHttpUrl('ftp://example.com')).toBe(false);
    expect(isHttpUrl('mailto:user@example.com')).toBe(false);
  });

  it('rejects relative paths and plain text', () => {
    expect(isHttpUrl('/relative/path')).toBe(false);
    expect(isHttpUrl('relative/path')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl('   ')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
    expect(isHttpUrl(123)).toBe(false);
    expect(isHttpUrl({})).toBe(false);
  });
});
