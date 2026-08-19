/**
 * Shared field formatting utilities for popups, tables, and exports
 */

import type { GeoJsonProperties } from 'geojson'
import type {
  FieldConfig,
  NumberPopupFieldConfig,
  StringPopupFieldConfig,
  DatePopupFieldConfig,
  CustomPopupFieldConfig,
} from '@/lib/types/mapping-types'

// Type guards
export const isNumberField = (field: FieldConfig | undefined): field is NumberPopupFieldConfig =>
  !!field && field.type === 'number'

export const isStringField = (field: FieldConfig | undefined): field is StringPopupFieldConfig =>
  !!field && field.type === 'string'

export const isDateField = (field: FieldConfig | undefined): field is DatePopupFieldConfig =>
  !!field && field.type === 'date'

export const isCustomField = (field: FieldConfig | undefined): field is CustomPopupFieldConfig =>
  !!field && field.type === 'custom'

/**
 * Format a number with specified decimal places
 */
export const formatWithDecimalPlaces = (value: number, decimalPlaces: number): string => {
  if (isNaN(value)) return 'N/A'
  return Number(value.toFixed(decimalPlaces)).toString()
}

/**
 * Get the default transform function for a number field config
 */
export const getNumberFieldTransform = (config: NumberPopupFieldConfig): ((value: number) => string) => {
  return (value: number) => {
    const numericValue = typeof value === 'number' && !isNaN(value) ? value : 0
    let formatted = config.decimalPlaces
      ? formatWithDecimalPlaces(numericValue, config.decimalPlaces)
      : numericValue.toString()

    if (config.unit) {
      formatted += ` ${config.unit}`
    }
    return formatted
  }
}

/**
 * Format a date value into the specified format
 */
export const formatDate = (value: unknown, format: DatePopupFieldConfig['format'] = 'iso'): string => {
  if (value === null || value === undefined || value === '') return ''
  const date = new Date(String(value))
  if (isNaN(date.getTime())) return String(value)

  switch (format) {
    case 'short':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    case 'long':
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    case 'monthYear':
      // MM-YYYY, read in UTC. The InSAR period dates arrive as UTC-midnight
      // instants (e.g. 2023-10-01T00:00:00Z); using local time would slip a
      // first-of-month reading back into the prior month west of UTC.
      return `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`
    default:
      return date.toISOString().slice(0, 10)
  }
}

/**
 * Capitalize only the first character of a string, leaving the rest as-is
 * (so "very low" -> "Very low", not "Very Low"). Passes through empty/null.
 */
export const capitalizeFirst = (value: string | null): string | null => {
  if (value === null || value === '') return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Convert a value to a string, automatically formatting scientific notation 
 * representing a standard number into plain digit strings (e.g. 4.304735231e+13 -> 43047352310000).
 */
export const formatStringValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }
  const str = String(value)
  if (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
    const num = Number(str)
    if (!isNaN(num)) {
      // Use toLocaleString('fullwide', {useGrouping:false}) or just toString()
      // toString() for very large numbers in JS might revert to scientific notation.
      // However, for the expected range of API numbers, toString() is sufficient.
      // If we need absolute precision for even larger integers, BigInt might be needed.
      return num.toLocaleString('fullwide', { useGrouping: false })
    }
  }
  return str
}

/**
 * Format a field value based on its config
 * Works for string, number, date, and custom field types
 */
export const formatFieldValue = (
  fieldConfig: FieldConfig | undefined,
  rawValue: unknown,
  properties?: GeoJsonProperties
): string => {
  if (!fieldConfig) {
    return formatStringValue(rawValue)
  }

  // Handle custom fields
  if (isCustomField(fieldConfig)) {
    return fieldConfig.transform?.(properties ?? {})?.toString() ?? ''
  }

  // Handle number fields
  if (isNumberField(fieldConfig)) {
    const numberForTransform = rawValue === null ? null : Number(rawValue)
    const numberForDefault = Number(rawValue ?? 0)

    if (fieldConfig.transform) {
      return fieldConfig.transform(numberForTransform) ?? ''
    }
    return getNumberFieldTransform(fieldConfig)(numberForDefault)
  }

  // Handle date fields
  if (isDateField(fieldConfig)) {
    return formatDate(rawValue, fieldConfig.format)
  }

  // Handle string fields
  if (isStringField(fieldConfig)) {
    if (fieldConfig.transform) {
      return fieldConfig.transform(formatStringValue(rawValue)) ?? ''
    }
    return formatStringValue(rawValue)
  }

  // Fallback
  return formatStringValue(rawValue)
}
