import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LANGUAGE_COOKIE, TIME_ZONE_COOKIE } from "./config";
import { isValidTimeZone, resolveLocale } from "./resolve";

export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const { language, locale } = resolveLocale({
    cookieLanguage: cookieStore.get(LANGUAGE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });
  const timeZone = cookieStore.get(TIME_ZONE_COOKIE)?.value;

  return {
    locale,
    timeZone: isValidTimeZone(timeZone) ? timeZone : "UTC",
    messages: (await import(`../../messages/${language}.json`)).default,
  };
});
