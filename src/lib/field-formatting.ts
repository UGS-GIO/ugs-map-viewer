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
    default:
      return date.toISOString().slice(0, 10)
  }
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
    return rawValue === null || rawValue === undefined ? '' : String(rawValue)
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
      return fieldConfig.transform(rawValue === null ? null : String(rawValue)) ?? ''
    }
    return String(rawValue ?? '')
  }

  // Fallback
  return rawValue === null || rawValue === undefined ? '' : String(rawValue)
}
