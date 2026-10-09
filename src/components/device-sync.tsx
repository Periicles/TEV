"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTimeZone } from "next-intl";
import { TIME_ZONE_COOKIE } from "@/i18n/config";

/**
 * Keeps the server in sync with the device: sets `<html lang>` and stores the device time zone in a
 * cookie so server-rendered dates use it, refreshing once when it changes.
 */
export function DeviceSync({ lang }: { lang: string }) {
  const router = useRouter();
  const serverTimeZone = useTimeZone();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (deviceTimeZone && deviceTimeZone !== serverTimeZone) {
      document.cookie = `${TIME_ZONE_COOKIE}=${deviceTimeZone}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [router, serverTimeZone]);

  return null;
}
