import { describe, it, expect } from 'vitest';
import { formatNumeric, toTitleCase, toSentenceCase } from '../utils';

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
