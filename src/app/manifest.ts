import type { MetadataRoute } from "next";

/** Dark background of the icon and of the splash screen shown while the installed app starts. */
const BACKGROUND = "#0a0a0a";

/** Makes TEV installable on a phone's home screen, where it opens full screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TEV — Dépenses de voyage",
    short_name: "TEV",
    description: "Suivi des dépenses de voyage",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BACKGROUND,
    theme_color: BACKGROUND,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
