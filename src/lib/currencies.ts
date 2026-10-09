/** Currencies offered first in pickers; any ISO 4217 code remains valid. */
export const COMMON_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "JPY",
  "CAD",
  "AUD",
  "NZD",
  "CNY",
  "HKD",
  "KRW",
  "TWD",
  "SGD",
  "THB",
  "VND",
  "IDR",
  "MYR",
  "PHP",
  "INR",
  "AED",
  "ILS",
  "TRY",
  "MAD",
  "EGP",
  "ZAR",
  "MXN",
  "BRL",
  "ARS",
  "CLP",
  "COP",
  "PEN",
  "SEK",
  "NOK",
  "DKK",
  "ISK",
  "PLN",
  "CZK",
  "HUF",
] as const;

export function currencyName(code: string, locale: string): string {
  return new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
}

/** Common currencies sorted by localized name, with `extra` codes (already in use) kept. */
export function currencyOptions(locale: string, extra: string[] = []) {
  const codes = [...new Set([...COMMON_CURRENCIES, ...extra])];
  return codes
    .map((code) => ({ code, label: `${currencyName(code, locale)} (${code})` }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}
