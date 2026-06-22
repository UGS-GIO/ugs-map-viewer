import { describe, it, expect } from 'vitest';
import {
  isNumberField,
  isStringField,
  isCustomField,
  formatWithDecimalPlaces,
  getNumberFieldTransform,
  formatFieldValue,
} from '../field-formatting';
import type {
  NumberPopupFieldConfig,
  StringPopupFieldConfig,
  CustomPopupFieldConfig,
} from '@/lib/types/mapping-types';

// ── Type Guards ──────────────────────────────────────────────────────────

describe('type guards', () => {
  it('correctly identifies each field type', () => {
    const num: NumberPopupFieldConfig = { type: 'number', field: 'depth' };
    const str: StringPopupFieldConfig = { type: 'string', field: 'name' };
    const custom: CustomPopupFieldConfig = { type: 'custom', field: 'computed' };

    expect(isNumberField(num)).toBe(true);
    expect(isNumberField(str)).toBe(false);
    expect(isStringField(str)).toBe(true);
    expect(isStringField(num)).toBe(false);
    expect(isCustomField(custom)).toBe(true);
    expect(isCustomField(undefined)).toBe(false);
  });
});

// ── formatWithDecimalPlaces ──────────────────────────────────────────────

describe('formatWithDecimalPlaces', () => {
  it('formats and strips trailing zeros', () => {
    expect(formatWithDecimalPlaces(3.14159, 2)).toBe('3.14');
    expect(formatWithDecimalPlaces(3.10, 2)).toBe('3.1');
  });

  it('returns N/A for NaN', () => {
    expect(formatWithDecimalPlaces(NaN, 2)).toBe('N/A');
  });
});

// ── getNumberFieldTransform ──────────────────────────────────────────────

describe('getNumberFieldTransform', () => {
  it('formats with decimal places and unit', () => {
    const config: NumberPopupFieldConfig = {
      type: 'number', field: 'depth', decimalPlaces: 1, unit: 'ft',
    };
    expect(getNumberFieldTransform(config)(123.456)).toBe('123.5 ft');
  });

  it('treats NaN input as 0', () => {
    const config: NumberPopupFieldConfig = { type: 'number', field: 'depth', unit: 'm' };
    expect(getNumberFieldTransform(config)(NaN)).toBe('0 m');
  });
});

// ── formatFieldValue ────────────────────────────────────────────────────

describe('formatFieldValue', () => {
  it('returns empty string for null/undefined without config', () => {
    expect(formatFieldValue(undefined, null)).toBe('');
    expect(formatFieldValue(undefined, undefined)).toBe('');
    expect(formatFieldValue(undefined, 42)).toBe('42');
  });

  it('handles scientific notation strings and numbers in string fields', () => {
    const config: StringPopupFieldConfig = { type: 'string', field: 'api_number' };
    expect(formatFieldValue(config, '4.304735231e+13')).toBe('43047352310000');
    expect(formatFieldValue(config, 4.304735231e13)).toBe('43047352310000');
    expect(formatFieldValue(config, '4.304735231e13')).toBe('43047352310000');
    expect(formatFieldValue(config, '-4.304735231e+13')).toBe('-43047352310000');
    expect(formatFieldValue(config, 'normal_string')).toBe('normal_string');
    expect(formatFieldValue(undefined, '4.304735231e+13')).toBe('43047352310000');
  });

  it('handles string fields with and without transforms', () => {
    const config: StringPopupFieldConfig = { type: 'string', field: 'name' };
    expect(formatFieldValue(config, 'test')).toBe('test');
    expect(formatFieldValue(config, null)).toBe('');

    const withTransform: StringPopupFieldConfig = {
      type: 'string', field: 'name',
      transform: (v) => v ? v.toUpperCase() : null,
    };
    expect(formatFieldValue(withTransform, 'hello')).toBe('HELLO');
  });

  it('handles number fields with formatting and transform', () => {
    const config: NumberPopupFieldConfig = {
      type: 'number', field: 'depth', decimalPlaces: 2, unit: 'm',
    };
    expect(formatFieldValue(config, 3.14159)).toBe('3.14 m');
    expect(formatFieldValue(config, '3.14159')).toBe('3.14 m');

    const withTransform: NumberPopupFieldConfig = {
      type: 'number', field: 'depth',
      transform: (v) => v !== null ? `${v} feet` : 'N/A',
    };
    expect(formatFieldValue(withTransform, 42)).toBe('42 feet');
    expect(formatFieldValue(withTransform, null)).toBe('N/A');
  });

  it('handles custom fields using full properties', () => {
    const config: CustomPopupFieldConfig = {
      type: 'custom', field: 'computed',
      transform: (props) => `${props?.first} ${props?.last}`,
    };
    expect(formatFieldValue(config, undefined, { first: 'John', last: 'Doe' })).toBe('John Doe');

    const noTransform: CustomPopupFieldConfig = { type: 'custom', field: 'computed' };
    expect(formatFieldValue(noTransform, 'ignored')).toBe('');
  });
});
