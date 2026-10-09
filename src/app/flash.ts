import { cookies } from "next/headers";

/**
 * A message for the next page, shown as a toast by `<FlashToaster>`: server actions redirect, so
 * the message travels in a short-lived cookie the browser reads (and clears) after navigating.
 */
export type Flash =
  | { kind: "tripCreated" | "tripSaved" | "expenseAdded" | "expenseSaved" }
  | { kind: "tripImported"; count: number }
  | { kind: "tripDeleted" | "expenseDeleted"; id: string };

/** Read on the client by `<FlashToaster>`, which keeps its own copy of the name. */
const FLASH_COOKIE = "tev-flash";

export async function flash(message: Flash) {
  // Next encodes the value: the client decodes it once.
  (await cookies()).set(FLASH_COOKIE, JSON.stringify(message), {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
  });
}
