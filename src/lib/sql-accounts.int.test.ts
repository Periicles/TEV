import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createUser } from "@/lib/users";

// Runs the exact SQL documented for the owner, with the placeholder values replaced.
function documentedSql(file: string, values: Record<string, string>) {
  let sql = readFileSync(`docs/sql/${file}`, "utf8");
  for (const [placeholder, value] of Object.entries(values)) {
    sql = sql.replace(`'${placeholder}'`, `'${value.replaceAll("'", "''")}'`);
  }
  return db.$client.query(sql);
}

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = (name: string) => `${name}-${run}@test.local`;
const created: string[] = [];

async function signIn(address: string, password: string) {
  const response = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: address, password }),
    }),
  );
  return response.status;
}

afterAll(async () => {
  if (created.length > 0) await db.delete(user).where(inArray(user.email, created));
});

describe.skipIf(!process.env.DATABASE_URL)("accounts managed in SQL", () => {
  it("signs in with an account created by docs/sql/create-account.sql", async () => {
    const address = email("sql-owner");
    created.push(address);
    await documentedSql("create-account.sql", {
      "you@example.com": ` ${address.toUpperCase()} `,
      "Your Name": "SQL Owner",
      "change-me-please": "a password with 'quotes'",
    });

    expect(await signIn(address, "a password with 'quotes'")).toBe(200);
    expect(await signIn(address, "the-wrong-password")).toBe(401);
  });

  it("resets the password and signs out with docs/sql/reset-password.sql", async () => {
    const address = email("sql-reset");
    created.push(address);
    const owner = await createUser({ email: address, name: "Reset", password: "a-long-password" });
    expect(await signIn(address, "a-long-password")).toBe(200);

    await documentedSql("reset-password.sql", {
      "you@example.com": address,
      "change-me-please": "another-long-password",
    });

    expect(await db.select().from(session).where(eq(session.userId, owner.id))).toHaveLength(0);
    expect(await signIn(address, "a-long-password")).toBe(401);
    expect(await signIn(address, "another-long-password")).toBe(200);
  });
});
