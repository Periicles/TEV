export const languages = ["fr", "en"] as const;
export type Language = (typeof languages)[number];

export const defaultLanguage: Language = "fr";

/** Explicit language chosen by the user. Absent means "follow the device". */
export const LANGUAGE_COOKIE = "tev-language";
/** Time zone reported by the device, used to format dates on the server. */
export const TIME_ZONE_COOKIE = "tev-time-zone";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (languages as readonly string[]).includes(value);
}
