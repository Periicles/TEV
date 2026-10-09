import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

const BCRYPT_COST = 12;

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
    // Accounts are created by the owner, directly in the database or with `pnpm user:create`.
    disableSignUp: true,
    minPasswordLength: 12,
    // bcrypt ignores anything past 72 bytes.
    maxPasswordLength: 72,
    // bcrypt instead of Better Auth's default scrypt: PostgreSQL can produce the same hashes with
    // pgcrypto (`crypt(password, gen_salt('bf', 12))`), so an account can be created in plain SQL.
    password: {
      hash: (password) => bcrypt.hash(password, BCRYPT_COST),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
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
