import { describe, expect, it } from "vitest";
import { isValidTimeZone, parseAcceptLanguage, resolveLocale } from "./resolve";

describe("parseAcceptLanguage", () => {
  it("orders locales by quality, keeping header order on ties", () => {
    expect(parseAcceptLanguage("en;q=0.8, fr-CA, de;q=0.8, *;q=0.1")).toEqual([
      "fr-CA",
      "en",
      "de",
    ]);
  });

  it("ignores empty, invalid and refused entries", () => {
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage("en;q=0, not a locale!, fr")).toEqual(["fr"]);
  });
});

describe("resolveLocale", () => {
  it("follows the device language and keeps its region for formatting", () => {
    expect(resolveLocale({ acceptLanguage: "en-GB,en;q=0.9" })).toEqual({
      language: "en",
      locale: "en-GB",
    });
  });

  it("falls back to French for unsupported languages", () => {
    expect(resolveLocale({ acceptLanguage: "ja-JP,de;q=0.5" })).toEqual({
      language: "fr",
      locale: "fr",
    });
    expect(resolveLocale({})).toEqual({ language: "fr", locale: "fr" });
  });

  it("prefers the language chosen by the user over the device", () => {
    expect(resolveLocale({ cookieLanguage: "fr", acceptLanguage: "en-US" })).toEqual({
      language: "fr",
      locale: "fr",
    });
    expect(resolveLocale({ cookieLanguage: "en", acceptLanguage: "fr-BE, en-AU;q=0.5" })).toEqual({
      language: "en",
      locale: "en-AU",
    });
  });

  it("ignores an unknown stored language", () => {
    expect(resolveLocale({ cookieLanguage: "xx", acceptLanguage: "en-US" }).language).toBe("en");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA time zones only", () => {
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});
