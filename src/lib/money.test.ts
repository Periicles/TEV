import { describe, expect, it } from "vitest";
import {
  convert,
  currencyDigits,
  formatMoney,
  isCurrency,
  parseAmount,
  splitEvenly,
} from "./money";

describe("currencyDigits", () => {
  it("knows each currency's minor unit", () => {
    expect(currencyDigits("EUR")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(currencyDigits("KWD")).toBe(3);
  });
});

describe("isCurrency", () => {
  it("accepts ISO 4217 codes only", () => {
    expect(isCurrency("JPY")).toBe(true);
    expect(isCurrency("XYZ")).toBe(false);
    expect(isCurrency("eur")).toBe(false);
  });
});

describe("parseAmount", () => {
  it.each([
    ["3850", "JPY", 3850],
    ["3 850", "JPY", 3850],
    ["3,850", "JPY", 3850],
    ["23,83", "EUR", 2383],
    ["23.83", "EUR", 2383],
    ["23", "EUR", 2300],
    ["23,5", "EUR", 2350],
    ["1 234,56", "EUR", 123456],
    ["1.234,56", "EUR", 123456],
    ["1,234.56", "USD", 123456],
    ["1,234", "EUR", 123400],
    ["1.234.567", "EUR", 123456700],
    ["3 175,00", "EUR", 317500],
    ["1.5", "KWD", 1500],
  ])("parses %j in %s as %i", (input, currency, expected) => {
    expect(parseAmount(input, currency)).toBe(expected);
  });

  it.each([
    ["", "EUR"],
    ["abc", "EUR"],
    ["0", "EUR"],
    ["-5", "EUR"],
    ["3.5", "JPY"],
    ["1.234,567", "EUR"],
  ])("rejects %j in %s", (input, currency) => {
    expect(parseAmount(input, currency)).toBeNull();
  });

  it("reads a lone separator followed by three digits as thousands", () => {
    expect(parseAmount("23,833", "EUR")).toBe(2383300);
  });
});

describe("formatMoney", () => {
  it("formats minor units with the currency's decimals and the locale", () => {
    expect(formatMoney(2383, "EUR", "fr-FR")).toBe("23,83 €");
    expect(formatMoney(3850, "JPY", "en-GB")).toBe("JP¥3,850");
  });
});

describe("convert", () => {
  it("converts with a rate read as 1 base = rate foreign", () => {
    // 3 850 JPY at 1 EUR = 161.56 JPY
    expect(convert(3850, "JPY", 161.56, "EUR")).toBe(2383);
    // 100.00 USD at 1 EUR = 1.08 USD
    expect(convert(10000, "USD", 1.08, "EUR")).toBe(9259);
  });

  it("keeps the amount in the same currency", () => {
    expect(convert(2383, "EUR", 1, "EUR")).toBe(2383);
  });

  it("refuses a non-positive rate", () => {
    expect(() => convert(100, "USD", 0, "EUR")).toThrow();
  });
});

describe("splitEvenly", () => {
  it("splits into shares that add up to the amount", () => {
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEvenly(2383, 2)).toEqual([1192, 1191]);
    expect(splitEvenly(10, 1)).toEqual([10]);
  });

  it("needs at least one part", () => {
    expect(() => splitEvenly(10, 0)).toThrow();
  });
});
