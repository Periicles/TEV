"use client";

import { LogOutIcon, Settings2Icon, TagsIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { languages } from "@/i18n/config";
import { setLanguagePreference } from "@/i18n/actions";
import { signOut } from "@/app/auth-actions";

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

export function PreferencesMenu({
  languagePreference,
  signedIn,
}: {
  languagePreference: string;
  signedIn: boolean;
}) {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("preferences.title")}>
          <Settings2Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("preferences.language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={languagePreference}
          onValueChange={(value) => startTransition(() => setLanguagePreference(value))}
        >
          <DropdownMenuRadioItem value="auto" disabled={pending}>
            {t("preferences.languageAuto")}
          </DropdownMenuRadioItem>
          {languages.map((language) => (
            <DropdownMenuRadioItem key={language} value={language} disabled={pending}>
              {t(`languages.${language}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t("preferences.theme")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={hydrated ? (theme ?? "system") : "system"}
          onValueChange={setTheme}
        >
          {themes.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {t(`preferences.${themeLabels[value]}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {signedIn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/categories">
                <TagsIcon />
                {t("preferences.categories")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
              <LogOutIcon />
              {t("auth.signOut")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
