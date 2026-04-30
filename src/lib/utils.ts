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

// Geophysics app wants dates to all follow the format of YYYY-MM-DD, but they have a mix of formats in their data.  
export function toISO8601Date(value: string | null | undefined): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const ddmmyy = value.match(/^(\d{2})-(\d{2})-(\d{2})$/);
    if (ddmmyy) {
        const [, dd, mm, yy] = ddmmyy;
        const fullYear = parseInt(yy) <= 30 ? `20${yy}` : `19${yy}`;
        return `${fullYear}-${mm}-${dd}`;
    }
    const ddmmyyyy = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyy) {
        const [, dd, mm, yyyy] = ddmmyyyy;
        return `${yyyy}-${mm}-${dd}`;
    }
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return value;
}