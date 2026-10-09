import { auth } from "@/lib/auth";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string) {
  const ctx = await auth.$context;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    throw new Error(
      `The password must be between ${minPasswordLength} and ${maxPasswordLength} characters.`,
    );
  }
  return ctx.password.hash(password);
}

/** Creates an email/password account. Sign-up is disabled in the app, so this is the only way in. */
export async function createUser(input: { email: string; name: string; password: string }) {
  const ctx = await auth.$context;
  const email = normalizeEmail(input.email);
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    throw new Error(`A user with the email ${email} already exists.`);
  }
  const hash = await hashPassword(input.password);
  const user = await ctx.internalAdapter.createUser(
    { email, name: input.name.trim(), emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });
  return user;
}

/** Replaces a user's password and signs them out everywhere. */
export async function setUserPassword(input: { email: string; password: string }) {
  const ctx = await auth.$context;
  const email = normalizeEmail(input.email);
  const found = await ctx.internalAdapter.findUserByEmail(email);
  if (!found) throw new Error(`No user with the email ${email}.`);
  await ctx.internalAdapter.updatePassword(found.user.id, await hashPassword(input.password));
  await ctx.internalAdapter.deleteUserSessions(found.user.id);
  return found.user;
}
