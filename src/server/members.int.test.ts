import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { user } from "@/db/schema";
import { createUser } from "@/lib/users";
import {
  addMember,
  createExpense,
  createTrip,
  deleteExpense,
  deleteTrip,
  getTripDetails,
  InputError,
  listCategories,
  listMembers,
  listTrips,
  NotFoundError,
  removeMember,
  restoreExpense,
  restoreTrip,
  updateTrip,
  type ExpenseInput,
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

async function sharedTrip() {
  const created = await createTrip(owner, {
    name: "Japon",
    baseCurrency: "EUR",
    startDate: null,
    endDate: null,
    participants: [{ name: "Paul" }, { name: "Léa" }],
  });
  // The email is matched without case.
  await addMember(owner, created.id, emails[1].toUpperCase());
  return getTripDetails(owner, created.id);
}

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

describe.skipIf(!process.env.DATABASE_URL)("shared trips", () => {
  it("lets members see and edit the trip, with its owner's categories", async () => {
    const trip = await sharedTrip();
    const ids = trip.participants.map((p) => p.id);

    const listed = (await listTrips(member)).find((t) => t.id === trip.id);
    expect(listed).toMatchObject({ ownerId: owner, ownerName: "Paul", shared: true });
    expect((await listTrips(owner)).find((t) => t.id === trip.id)?.shared).toBe(true);

    const ownerFood = (await listCategories(owner)).find((c) => c.key === "food")!;
    const memberFood = (await listCategories(member)).find((c) => c.key === "food")!;
    const added = await createExpense(member, trip.id, expenseOf(ids, ownerFood.id));
    // Categories come from the trip's owner, not from whoever adds the expense.
    await expect(
      createExpense(member, trip.id, expenseOf(ids, memberFood.id)),
    ).rejects.toBeInstanceOf(NotFoundError);

    const seen = await getTripDetails(owner, trip.id);
    expect(seen.expenses.map((e) => e.id)).toEqual([added.id]);

    await updateTrip(member, trip.id, {
      name: "Japon 2025",
      baseCurrency: "EUR",
      startDate: null,
      endDate: null,
      participants: trip.participants.map((p) => ({ id: p.id, name: p.name })),
    });
    expect((await getTripDetails(owner, trip.id)).name).toBe("Japon 2025");

    await deleteExpense(member, added.id);
    await restoreExpense(owner, added.id);
  });

  it("keeps deleting the trip and managing members to its owner", async () => {
    const trip = await sharedTrip();
    await expect(deleteTrip(member, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(addMember(member, trip.id, emails[2])).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeMember(member, trip.id, owner)).rejects.toBeInstanceOf(NotFoundError);

    await deleteTrip(owner, trip.id);
    await expect(getTripDetails(member, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(restoreTrip(member, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    await restoreTrip(owner, trip.id);
    await getTripDetails(member, trip.id);
  });

  it("explains who cannot be added", async () => {
    const trip = await sharedTrip();
    const codeOf = (promise: Promise<unknown>) =>
      promise.then(
        () => null,
        (error: unknown) => (error instanceof InputError ? error.code : error),
      );
    expect(await codeOf(addMember(owner, trip.id, "nobody@test.local"))).toBe("userNotFound");
    expect(await codeOf(addMember(owner, trip.id, emails[1]))).toBe("alreadyMember");
    expect(await codeOf(addMember(owner, trip.id, emails[0]))).toBe("alreadyMember");
  });

  it("lists members, and lets the owner remove them or a member leave", async () => {
    const trip = await sharedTrip();
    await addMember(owner, trip.id, emails[2]);
    const { owner: listedOwner, members } = await listMembers(member, trip.id);
    expect(listedOwner).toMatchObject({ id: owner, name: "Paul" });
    expect(members.map((m) => m.name)).toEqual(["Léa", "Max"]);

    await removeMember(owner, trip.id, stranger);
    await expect(getTripDetails(stranger, trip.id)).rejects.toBeInstanceOf(NotFoundError);

    await removeMember(member, trip.id, member);
    await expect(getTripDetails(member, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listTrips(owner)).find((t) => t.id === trip.id)?.shared).toBe(false);
  });

  it("hides the trip from other accounts", async () => {
    const trip = await sharedTrip();
    await expect(getTripDetails(stranger, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listMembers(stranger, trip.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listTrips(stranger)).some((t) => t.id === trip.id)).toBe(false);
  });
});
