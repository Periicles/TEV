import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { DeviceSync } from "./device-sync";

/**
 * Resolves the locale for the request (cookie or `Accept-Language`) and exposes it to the tree.
 * It reads request data, so it must be rendered inside a `<Suspense>` boundary.
 */
export async function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <NextIntlClientProvider>
      <DeviceSync lang={locale} />
      {children}
    </NextIntlClientProvider>
  );
}
