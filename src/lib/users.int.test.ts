import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createUser, setUserPassword } from "@/lib/users";

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

describe.skipIf(!process.env.DATABASE_URL)("accounts", () => {
  it("creates a user who can sign in with the right password only", async () => {
    const address = email("owner");
    created.push(address);
    await createUser({
      email: ` ${address.toUpperCase()} `,
      name: "Owner",
      password: "a-long-password",
    });

    expect(await signIn(address, "a-long-password")).toBe(200);
    expect(await signIn(address, "the-wrong-password")).toBe(401);
  });

  it("refuses duplicate emails and short passwords", async () => {
    const address = email("dup");
    created.push(address);
    await createUser({ email: address, name: "Dup", password: "a-long-password" });

    await expect(
      createUser({ email: address, name: "Dup", password: "a-long-password" }),
    ).rejects.toThrow(/already exists/);
    await expect(
      createUser({ email: email("short"), name: "Short", password: "too-short" }),
    ).rejects.toThrow(/between 12 and 72/);
  });

  it("does not allow signing up from the app", async () => {
    const address = email("intruder");
    created.push(address);
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: address, password: "a-long-password", name: "Intruder" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await db.select().from(user).where(eq(user.email, address))).toHaveLength(0);
  });

  it("changes a password and signs the user out everywhere", async () => {
    const address = email("reset");
    created.push(address);
    const owner = await createUser({ email: address, name: "Reset", password: "a-long-password" });
    expect(await signIn(address, "a-long-password")).toBe(200);

    await setUserPassword({ email: address, password: "another-long-password" });

    expect(await db.select().from(session).where(eq(session.userId, owner.id))).toHaveLength(0);
    expect(await signIn(address, "a-long-password")).toBe(401);
    expect(await signIn(address, "another-long-password")).toBe(200);
  });
});
