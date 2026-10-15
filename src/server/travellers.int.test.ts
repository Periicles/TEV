import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { user } from "@/db/schema";
import { createUser } from "@/lib/users";
import {
  createExpense,
  createTrip,
  deleteExpense,
  deleteTrip,
  getTripDetails,
  InputError,
  leaveTrip,
  listCategories,
  listTrips,
  NotFoundError,
  restoreExpense,
  restoreTrip,
  updateTrip,
  type ExpenseInput,
  type TripInput,
} from "./trips";

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emails = [
  `share-owner-${run}@test.local`,
  `share-member-${run}@test.local`,
  `share-stranger-${run}@test.local`,
];
let owner: string;
let member: string;
let stranger: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  owner = (await createUser({ email: emails[0], name: "Paul", password: "a-long-password" })).id;
  member = (await createUser({ email: emails[1], name: "Léa", password: "a-long-password" })).id;
  stranger = (await createUser({ email: emails[2], name: "Max", password: "a-long-password" })).id;
});

afterAll(async () => {
  if (process.env.DATABASE_URL) await db.delete(user).where(inArray(user.email, emails));
});

const base = { name: "Japon", baseCurrency: "EUR", startDate: null, endDate: null };

/** A trip shared with Léa: she is a participant linked to her account (email in capitals). */
async function sharedTrip() {
  const created = await createTrip(owner, {
    ...base,
    participants: [
      { name: "Paul", email: emails[0] },
      { name: "Léa", email: emails[1].toUpperCase() },
      { name: "Tom" },
    ],
  });
  return getTripDetails(owner, created.id);
}

/** The participants as the trip form sends them back. */
const asInput = (trip: Awaited<ReturnType<typeof sharedTrip>>): TripInput["participants"] =>
  trip.participants.map((p) => ({ id: p.id, name: p.name, email: p.email }));

function expenseOf(participantIds: string[], categoryId: string | null): ExpenseInput {
  return {
    date: "2025-03-20",
    label: "Ramen",
    amountMinor: 1500,
    currency: "EUR",
    exchangeRate: null,
    categoryId,
    paymentMethod: null,
    notes: null,
    participantIds,
    paidBy: null,
  };
}

describe.skipIf(!process.env.DATABASE_URL)("trips shared through participants' accounts", () => {
  it("links participants to accounts by email", async () => {
    const trip = await sharedTrip();
    expect(trip.participants.map((p) => [p.name, p.userId])).toEqual([
      ["Paul", owner],
      ["Léa", member],
      ["Tom", null],
    ]);
    const listed = (await listTrips(member)).find((t) => t.id === trip.id);
    expect(listed).toMatchObject({ ownerId: owner, ownerName: "Paul", shared: true });
    expect((await listTrips(owner)).find((t) => t.id === trip.id)?.shared).toBe(true);
  });

  it("lets linked participants edit the trip, with its owner's categories", async () => {
    const trip = await sharedTrip();
    const ids = trip.participants.map((p) => p.id);
    const ownerFood = (await listCategories(owner)).find((c) => c.key === "food")!;
    const memberFood = (await listCategories(member)).find((c) => c.key === "food")!;
    const added = await createExpense(member, trip.id, expenseOf(ids, ownerFood.id));
    await expect(
      createExpense(member, trip.id, expenseOf(ids, memberFood.id)),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await getTripDetails(owner, trip.id)).expenses.map((e) => e.id)).toEqual([added.id]);

    await updateTrip(member, trip.id, { ...base, name: "Japon 2025", participants: asInput(trip) });
    expect((await getTripDetails(owner, trip.id)).name).toBe("Japon 2025");
    await deleteExpense(member, added.id);
    await restoreExpense(owner, added.id);
  });

  it("keeps linking accounts and deleting the trip to its owner", async () => {
    const trip = await sharedTrip();
    // Léa tries to give Max access and to remove Paul's: the links stay as they were.
    const [paul, lea, tom] = asInput(trip);
    await updateTrip(member, trip.id, {
      ...base,
      participants: [{ ...paul, email: null }, lea, { ...tom, email: emails[2] }],
    });
    const after = await getTripDetails(owner, trip.id);
    expect(after.participants.map((p) => p.userId)).toEqual([owner, member, null]);
    await expect(getTripDetails(stranger, trip.id)).rejects.toBeInstanceOf(NotFoundError);

    await expect(deleteTrip(member, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    await deleteTrip(owner, trip.id);
    await expect(getTripDetails(member, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(restoreTrip(member, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    await restoreTrip(owner, trip.id);
    await getTripDetails(member, trip.id);
  });

  it("lets the owner move or remove access", async () => {
    const trip = await sharedTrip();
    const [paul, lea, tom] = asInput(trip);
    // Léa's account moves to Tom, in a single save.
    await updateTrip(owner, trip.id, {
      ...base,
      participants: [paul, { ...lea, email: null }, { ...tom, email: emails[1] }],
    });
    expect((await getTripDetails(owner, trip.id)).participants.map((p) => p.userId)).toEqual([
      owner,
      null,
      member,
    ]);
    await updateTrip(owner, trip.id, {
      ...base,
      participants: [paul, { ...lea, email: null }, { ...tom, email: null }],
    });
    await expect(getTripDetails(member, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listTrips(owner)).find((t) => t.id === trip.id)?.shared).toBe(false);
  });

  it("explains emails it cannot link", async () => {
    const trip = await sharedTrip();
    const [paul, lea, tom] = asInput(trip);
    const codeOf = (participants: TripInput["participants"]) =>
      updateTrip(owner, trip.id, { ...base, participants }).then(
        () => null,
        (error: unknown) => (error instanceof InputError ? error.code : error),
      );
    expect(await codeOf([paul, lea, { ...tom, email: "nobody@test.local" }])).toBe("userNotFound");
    expect(await codeOf([paul, lea, { ...tom, email: emails[1] }])).toBe("duplicateAccount");
  });

  it("lets a linked participant leave, keeping their share", async () => {
    const trip = await sharedTrip();
    const ids = trip.participants.map((p) => p.id);
    await createExpense(owner, trip.id, expenseOf(ids, null));
    await expect(leaveTrip(owner, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    await leaveTrip(member, trip.id);
    await expect(getTripDetails(member, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    const after = await getTripDetails(owner, trip.id);
    expect(after.participants.map((p) => [p.name, p.userId])).toEqual([
      ["Paul", owner],
      ["Léa", null],
      ["Tom", null],
    ]);
    expect(after.expenses[0].participantIds).toHaveLength(3);
  });

  it("hides the trip from other accounts", async () => {
    const trip = await sharedTrip();
    await expect(getTripDetails(stranger, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(leaveTrip(stranger, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listTrips(stranger)).some((t) => t.id === trip.id)).toBe(false);
  });
});
