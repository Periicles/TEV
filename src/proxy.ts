import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check: sends visitors without a session cookie to the login page. Pages still verify
 * the session itself on the server (`requireSession`), the cookie alone proves nothing.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the login page, the auth API, static assets and what installing the app needs
  // (manifest, icons, service worker and its offline page).
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|manifest.webmanifest|icon.svg|apple-icon.png|icons/|sw.js|offline.html).*)",
  ],
};
