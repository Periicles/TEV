import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { category, user } from "@/db/schema";
import { createUser } from "@/lib/users";
import { createCategory, deleteCategory, moveCategory, updateCategory } from "./categories";
import {
  createExpense,
  createTrip,
  getExpense,
  InputError,
  listCategories,
  NotFoundError,
} from "./trips";

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emails = [`cat-${run}@test.local`, `cat-other-${run}@test.local`];
let owner: string;
let other: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  owner = (await createUser({ email: emails[0], name: "Owner", password: "a-long-password" })).id;
  other = (await createUser({ email: emails[1], name: "Other", password: "a-long-password" })).id;
});

afterAll(async () => {
  if (process.env.DATABASE_URL) await db.delete(user).where(inArray(user.email, emails));
});

describe.skipIf(!process.env.DATABASE_URL)("categories", () => {
  it("adds a category at the end with its color", async () => {
    const before = await listCategories(owner);
    const created = await createCategory(owner, { name: " Souvenirs ", color: 4 });
    expect(created).toMatchObject({ name: "Souvenirs", key: null, color: 4 });
    expect(created.position).toBe(Math.max(...before.map((c) => c.position)) + 1);
  });

  it("renames a built-in category, which then keeps its name, and recolors it", async () => {
    const transport = (await listCategories(owner)).find((c) => c.key === "transport")!;
    const renamed = await updateCategory(owner, transport.id, { name: "Trains" });
    expect(renamed).toMatchObject({ key: null, name: "Trains", color: null });
    const recolored = await updateCategory(owner, transport.id, { color: 7 });
    expect(recolored).toMatchObject({ name: "Trains", color: 7 });
    await expect(updateCategory(owner, transport.id, { color: 9 })).rejects.toThrow();
  });

  it("reorders categories without changing their colors", async () => {
    const [first, second] = await listCategories(owner);
    await updateCategory(owner, first.id, { color: null });
    await updateCategory(owner, second.id, { color: null });
    await moveCategory(owner, second.id, "up");

    const [newFirst, newSecond] = await listCategories(owner);
    expect([newFirst.id, newSecond.id]).toEqual([second.id, first.id]);
    // Colors that followed the position are pinned, so they do not swap.
    expect(newFirst.color).toBe((second.position % 8) + 1);
    expect(newSecond.color).toBe((first.position % 8) + 1);
    await moveCategory(owner, newFirst.id, "up"); // already first: nothing happens
    expect((await listCategories(owner))[0].id).toBe(second.id);
  });

  it("deletes a category, leaving its expenses uncategorized, but never the last one", async () => {
    const trip = await createTrip(owner, {
      name: "Rome",
      baseCurrency: "EUR",
      startDate: null,
      endDate: null,
      participants: [{ name: "Paul" }],
    });
    const gifts = await createCategory(owner, { name: "Cadeaux", color: null });
    const [paul] = await db.query.participant.findMany({ where: (p) => eq(p.tripId, trip.id) });
    const expense = await createExpense(owner, trip.id, {
      date: "2025-03-20",
      label: "Magnet",
      amountMinor: 500,
      currency: "EUR",
      exchangeRate: null,
      categoryId: gifts.id,
      paymentMethod: null,
      notes: null,
      participantIds: [paul.id],
      paidBy: null,
    });
    await deleteCategory(owner, gifts.id);
    expect((await getExpense(owner, expense.id)).categoryId).toBeNull();

    const remaining = await listCategories(owner);
    for (const c of remaining.slice(1)) await deleteCategory(owner, c.id);
    await expect(deleteCategory(owner, remaining[0].id)).rejects.toThrow(
      new InputError("lastCategory"),
    );
    expect(await db.select().from(category).where(eq(category.userId, owner))).toHaveLength(1);
  });

  it("keeps other users' categories out of reach", async () => {
    const [theirs] = await listCategories(other);
    await expect(updateCategory(owner, theirs.id, { name: "Mine" })).rejects.toThrow(NotFoundError);
    await expect(deleteCategory(owner, theirs.id)).rejects.toThrow(NotFoundError);
    await expect(moveCategory(owner, theirs.id, "down")).rejects.toThrow(NotFoundError);
  });
});
