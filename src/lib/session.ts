import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Returns the signed-in session, or redirects to the login page. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
