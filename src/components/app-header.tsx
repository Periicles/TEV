import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { isLanguage, LANGUAGE_COOKIE } from "@/i18n/config";
import { getSession } from "@/lib/session";
import { unreadCount } from "@/server/notifications";
import { NotificationBell } from "./notification-bell";
import { PreferencesMenu } from "./preferences-menu";

export async function AppHeader() {
  const [t, cookieStore, session] = await Promise.all([
    getTranslations("app"),
    cookies(),
    getSession(),
  ]);
  const stored = cookieStore.get(LANGUAGE_COOKIE)?.value;
  const unread = session ? await unreadCount(session.user.id) : 0;

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-3xl items-center lg:max-w-6xl justify-between gap-4 px-4 py-3">
        <Link href="/" className="neon-text font-semibold tracking-wide">
          {t("name")}
        </Link>
        <div className="flex items-center gap-1">
          {session && <NotificationBell unread={unread} />}
          <PreferencesMenu
            languagePreference={isLanguage(stored) ? stored : "auto"}
            signedIn={Boolean(session)}
          />
        </div>
      </div>
    </header>
  );
}
