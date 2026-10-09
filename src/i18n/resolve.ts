import { match } from "@formatjs/intl-localematcher";
import { defaultLanguage, isLanguage, languages, type Language } from "./config";

/** Returns the locales of an `Accept-Language` header, most preferred first. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim(), quality: q ? Number(q.slice(2)) : 1, index };
    })
    .filter(({ tag, quality }) => tag && tag !== "*" && quality > 0 && isValidLocale(tag))
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map(({ tag }) => tag);
}

function isValidLocale(tag: string): boolean {
  try {
    return Intl.getCanonicalLocales(tag).length > 0;
  } catch {
    return false;
  }
}

export interface ResolvedLocale {
  /** UI language, picks the message catalog. */
  language: Language;
  /** Locale used to format dates and numbers, keeps the device region when it matches. */
  locale: string;
}

/**
 * Picks the UI language from the user's explicit choice, then the device languages, then the
 * default. The formatting locale keeps the device region (e.g. `en-GB`) when its language matches.
 */
export function resolveLocale(input: {
  cookieLanguage?: string | null;
  acceptLanguage?: string | null;
}): ResolvedLocale {
  const requested = parseAcceptLanguage(input.acceptLanguage);
  const language: Language = isLanguage(input.cookieLanguage)
    ? input.cookieLanguage
    : (match(requested, languages, defaultLanguage) as Language);

  const regional = requested.find((tag) => new Intl.Locale(tag).language === language);
  return { language, locale: regional ? Intl.getCanonicalLocales(regional)[0] : language };
}

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}
