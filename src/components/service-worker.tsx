"use client";

import { useEffect } from "react";

/** Registers the service worker (`public/sw.js`), which shows an offline page when the network is down. */
export function ServiceWorker() {
  useEffect(() => {
    // Not in development, where a worker left over from a previous build would only get in the way.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // The app works the same without it.
    });
  }, []);
  return null;
}
