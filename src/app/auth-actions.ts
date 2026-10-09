"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Signing in or out changes what every page shows: purge the client router cache, which may hold
// pages prefetched in the previous state (e.g. a redirect to /login prefetched while signed out).

/** Called once the browser has signed in through the auth API (which applies the rate limit). */
export async function afterSignIn() {
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  revalidatePath("/", "layout");
  redirect("/login");
}
