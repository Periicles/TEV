import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { LocaleProvider } from "@/components/locale-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TEV",
  description: "Suivi des dépenses de voyage",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // The shell stays static: theme and language depend on the device and are applied on the client
  // (theme by next-themes' inline script, language inside the Suspense boundary).
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense>
            <LocaleProvider>
              <AppHeader />
              {children}
            </LocaleProvider>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
