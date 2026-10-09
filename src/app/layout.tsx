import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
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
  // The shell stays static: the language depends on the request and is resolved inside the
  // Suspense boundary.
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Suspense>
          <LocaleProvider>{children}</LocaleProvider>
        </Suspense>
      </body>
    </html>
  );
}
