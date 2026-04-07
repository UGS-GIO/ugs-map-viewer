/**
 * CQL (Contextual Query Language) helpers for building GeoServer WMS/WFS filters.
 *
 * GeoServer parses CQL with single-quoted string literals where an embedded
 * quote is escaped by doubling it, e.g. `O'Reilly` → `'O''Reilly'`.
 */

/** Escape single quotes for embedding inside a CQL string literal. */
export const escapeCqlLiteral = (v: string): string => v.replace(/'/g, "''");

/** Quote a value as a CQL string literal: `foo` → `'foo'`, `O'Reilly` → `'O''Reilly'`. */
export const quoteCqlLiteral = (v: string): string => `'${escapeCqlLiteral(v)}'`;
