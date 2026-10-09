"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore, useTransition } from "react";
import { languages } from "@/i18n/config";
import { setLanguagePreference } from "@/i18n/actions";

const themes = ["system", "light", "dark"] as const;
const themeLabels = { system: "themeSystem", light: "themeLight", dark: "themeDark" } as const;

const subscribe = () => () => {};
/** `true` once hydrated: the stored theme is only known on the client. */
const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

export function PreferencesMenu({ languagePreference }: { languagePreference: string }) {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();

  const selectClass =
    "rounded-md border border-foreground/15 bg-background px-2 py-1 text-sm disabled:opacity-60";

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="language">
        {t("preferences.language")}
      </label>
      <select
        id="language"
        className={selectClass}
        value={languagePreference}
        disabled={pending}
        onChange={(event) => {
          const value = event.target.value;
          startTransition(() => setLanguagePreference(value));
        }}
      >
        <option value="auto">{t("preferences.languageAuto")}</option>
        {languages.map((language) => (
          <option key={language} value={language}>
            {t(`languages.${language}`)}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="theme">
        {t("preferences.theme")}
      </label>
      <select
        id="theme"
        className={selectClass}
        value={hydrated ? (theme ?? "system") : "system"}
        onChange={(event) => setTheme(event.target.value)}
      >
        {themes.map((value) => (
          <option key={value} value={value}>
            {t(`preferences.${themeLabels[value]}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
