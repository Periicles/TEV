import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { isLanguage, LANGUAGE_COOKIE } from "@/i18n/config";
import { PreferencesMenu } from "./preferences-menu";

export async function AppHeader() {
  const [t, cookieStore] = await Promise.all([getTranslations("app"), cookies()]);
  const stored = cookieStore.get(LANGUAGE_COOKIE)?.value;

  return (
    <header className="border-b border-foreground/10">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <span className="font-semibold">{t("name")}</span>
        <PreferencesMenu languagePreference={isLanguage(stored) ? stored : "auto"} />
      </div>
    </header>
  );
}
