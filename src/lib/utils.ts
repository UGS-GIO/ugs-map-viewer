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
  oneDecimal: (n) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
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

/** Safe in an `href`: http(s) or a same-origin path. Popup links are built from feature data. */
export function isSafeHref(href: string): boolean {
  // Browsers drop C0 controls anywhere in a URL, so strip them before judging it.
  // eslint-disable-next-line no-control-regex
  const value = href.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  // `/\host` — the backslash normalizes too, making the link protocol-relative.
  if (value.startsWith('/')) return value[1] !== '/' && value[1] !== '\\';
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** True if `v` is a string and a valid absolute URL with http: or https: protocol. */
export const isHttpUrl = (v: unknown): v is string =>
  typeof v === 'string' && URL.canParse(v.trim()) && ['http:', 'https:'].includes(new URL(v.trim()).protocol);
