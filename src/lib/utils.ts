import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** @deprecated Use formatNumeric(value, 'number') instead */
export function addThousandsSeparator(x: number | string): string {
  return formatNumeric(x, 'number');
}

// convert a string to title case
// ex. "hello world" -> "Hello World"
export function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
    }
  );
}

export function toSentenceCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

const numericFormatters: Record<string, (n: number) => string> = {
  number: (n) => n.toLocaleString('en-US'),
  currency: (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
  percent: (n) => n.toLocaleString('en-US', { style: 'percent', minimumFractionDigits: 1 }),
};

/** Round to N significant figures and stringify without scientific notation (1234 → "1,230", 12.34 → "12.3"). */
export function formatToSigFigs(n: number, sigFigs: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return '0';
  const rounded = Number(n.toPrecision(sigFigs));
  return Math.abs(rounded) >= 1000 ? rounded.toLocaleString('en-US') : String(rounded);
}

export function formatNumeric(value: unknown, format?: string): string {
  if (value === null || value === undefined || value === '') return '';

  // Handle objects/arrays by converting to JSON to avoid [object Object]
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  if (!format || !numericFormatters[format]) return String(value);

  const num = Number(value);
  if (isNaN(num)) return String(value);

  return numericFormatters[format](num);
}
/**
 * Stable 32-bit hash of a string (djb2-style, ×31).
 *
 * Used wherever free text has to become a deterministic id or index — a layer
 * title's colour, its source id, a cache table name — so those all agree and a
 * layer keeps the same colour and id across reloads.
 */
export function hashString(value: string): number {
    let h = 0
    for (let i = 0; i < value.length; i++) h = (Math.imul(h, 31) + value.charCodeAt(i)) >>> 0
    return h
}
