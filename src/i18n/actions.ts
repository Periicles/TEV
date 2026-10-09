"use server";

import { cookies } from "next/headers";
import { isLanguage, LANGUAGE_COOKIE } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Stores the language chosen by the user, or follows the device again with `"auto"`. */
export async function setLanguagePreference(value: string) {
  const cookieStore = await cookies();
  if (isLanguage(value)) {
    cookieStore.set(LANGUAGE_COOKIE, value, { maxAge: ONE_YEAR, sameSite: "lax", path: "/" });
  } else {
    cookieStore.delete(LANGUAGE_COOKIE);
  }
}
