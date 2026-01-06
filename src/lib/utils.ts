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
  if (!format || !numericFormatters[format]) return String(value);

  const num = Number(value);
  if (isNaN(num)) return String(value);

  return numericFormatters[format](num);
}