import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

/** Hosts this deployment may be reached on: the ones Vercel assigns to it, plus local development. */
function allowedHosts(): string[] {
  const hosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ].filter((host): host is string => Boolean(host));
  return process.env.VERCEL ? hosts : [...hosts, "localhost:3000"];
}

export const auth = betterAuth({
  appName: "TEV",
  baseURL: process.env.BETTER_AUTH_URL ?? { allowedHosts: allowedHosts() },
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Accounts are created by the owner with `pnpm user:create`, never from the app.
    disableSignUp: true,
    minPasswordLength: 12,
  },
  rateLimit: {
    // Serverless instances do not share memory: keep the counters in the database.
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  advanced: {
    // Set by Vercel's edge network and not spoofable by clients.
    ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
  },
  plugins: [nextCookies()],
});
