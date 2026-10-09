/**
 * Money is always handled as an integer amount of the currency's minor unit (cents for EUR, yen for
 * JPY), never as a floating-point number of major units.
 */

const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));

export function isCurrency(code: string): boolean {
  return supportedCurrencies.has(code);
}

/** Number of decimals of a currency's minor unit: 2 for EUR, 0 for JPY, 3 for KWD. */
export function currencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/**
 * Parses an amount typed by a person into minor units. Accepts spaces and either `.` or `,` as the
 * decimal separator (`1 234,56`, `1,234.56`, `3850`). Returns `null` when the input is not a
 * positive amount with at most the currency's number of decimals.
 */
export function parseAmount(input: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const compact = input.replace(/[\s  ']/g, "");
  if (!/^\d[\d.,]*$/.test(compact)) return null;

  const lastSeparator = Math.max(compact.lastIndexOf("."), compact.lastIndexOf(","));
  let integerPart = compact;
  let fractionPart = "";
  if (lastSeparator !== -1) {
    const separator = compact[lastSeparator];
    const after = compact.slice(lastSeparator + 1);
    const usesBoth = compact.includes(".") && compact.includes(",");
    const single = compact.indexOf(separator) === lastSeparator;
    // A lone separator followed by more digits than the currency allows is a thousands separator.
    const isDecimal =
      usesBoth || (single && after.length > 0 && after.length <= Math.max(digits, 2));
    if (isDecimal) {
      integerPart = compact.slice(0, lastSeparator);
      fractionPart = after;
    }
  }
  integerPart = integerPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(integerPart) || /[.,]/.test(fractionPart)) return null;
  if (fractionPart.length > digits) return null;

  const minor = Number(integerPart + fractionPart.padEnd(digits, "0"));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** Major units as a number, for display and inputs only. */
export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyDigits(currency);
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  const digits = currencyDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toMajor(minor, currency));
}

/**
 * Converts an expense amount into the trip's base currency. `rate` is how many units of the expense
 * currency one unit of the base currency buys, as people usually read it: `1 EUR = 161.56 JPY`.
 */
export function convert(amountMinor: number, from: string, rate: number, to: string): number {
  if (!(rate > 0)) throw new Error("The exchange rate must be positive.");
  if (from === to) return amountMinor;
  const major = toMajor(amountMinor, from) / rate;
  return Math.round(major * 10 ** currencyDigits(to));
}

/**
 * Splits an amount into `parts` integer shares that add up exactly to the amount. The remainder goes
 * one unit at a time to the first shares, so the same inputs always give the same split.
 */
export function splitEvenly(amountMinor: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1) throw new Error("Split into at least one part.");
  const base = Math.floor(amountMinor / parts);
  const remainder = amountMinor - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}
