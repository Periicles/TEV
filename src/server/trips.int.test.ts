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
  getExpense,
  getTripDetails,
  InputError,
  listCategories,
  listTrips,
  NotFoundError,
  updateExpense,
  updateTrip,
  type ExpenseInput,
} from "./trips";

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emails = [`owner-${run}@test.local`, `other-${run}@test.local`];
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

async function japanTrip() {
  const created = await createTrip(owner, {
    name: "Japon 2025",
    baseCurrency: "EUR",
    startDate: "2025-03-08",
    endDate: "2025-03-30",
    participants: [{ name: "Paul" }, { name: "Léa" }],
  });
  return getTripDetails(owner, created.id);
}

function expenseOf(participantIds: string[], overrides: Partial<ExpenseInput> = {}): ExpenseInput {
  return {
    date: "2025-03-20",
    label: "Sushiro",
    amountMinor: 3850,
    currency: "JPY",
    exchangeRate: 161.56,
    categoryId: null,
    paymentMethod: null,
    notes: null,
    participantIds,
    paidBy: null,
    ...overrides,
  };
}

describe.skipIf(!process.env.DATABASE_URL)("trips and expenses", () => {
  it("converts a foreign-currency expense and splits it between participants", async () => {
    const trip = await japanTrip();
    const [paul, lea] = trip.participants;
    await createExpense(owner, trip.id, expenseOf([paul.id, lea.id]));
    await createExpense(
      owner,
      trip.id,
      expenseOf([paul.id], {
        label: "Ryokan",
        amountMinor: 36664,
        currency: "EUR",
        exchangeRate: null,
      }),
    );

    const details = await getTripDetails(owner, trip.id);
    const sushi = details.expenses.find((e) => e.label === "Sushiro")!;
    expect(sushi).toMatchObject({
      baseAmountMinor: 2383,
      rateSource: "manual",
      exchangeRate: "161.5600000000",
    });
    expect(details.summary.totalMinor).toBe(2383 + 36664);
    expect(details.summary.byParticipant.get(paul.id)).toBe(1192 + 36664);
    expect(details.summary.byParticipant.get(lea.id)).toBe(1191);

    const [listed] = (await listTrips(owner)).filter((t) => t.id === trip.id);
    expect(listed).toMatchObject({
      totalMinor: 2383 + 36664,
      expenseCount: 2,
      participantCount: 2,
    });
  });

  it("requires a rate for a foreign currency", async () => {
    const trip = await japanTrip();
    const ids = trip.participants.map((p) => p.id);
    await expect(
      createExpense(owner, trip.id, expenseOf(ids, { exchangeRate: null })),
    ).rejects.toThrow(new InputError("rateRequired"));
  });

  it("keeps other users' trips, expenses and categories out of reach", async () => {
    const trip = await japanTrip();
    const ids = trip.participants.map((p) => p.id);
    const created = await createExpense(owner, trip.id, expenseOf(ids));

    expect((await listTrips(other)).some((t) => t.id === trip.id)).toBe(false);
    await expect(getTripDetails(other, trip.id)).rejects.toThrow(NotFoundError);
    await expect(getExpense(other, created.id)).rejects.toThrow(NotFoundError);
    await expect(createExpense(other, trip.id, expenseOf(ids))).rejects.toThrow(NotFoundError);
    await expect(updateExpense(other, created.id, expenseOf(ids))).rejects.toThrow(NotFoundError);
    await expect(deleteExpense(other, created.id)).rejects.toThrow(NotFoundError);
    await expect(deleteTrip(other, trip.id)).rejects.toThrow(NotFoundError);

    const [othersCategory] = await listCategories(other);
    await expect(
      createExpense(owner, trip.id, expenseOf(ids, { categoryId: othersCategory.id })),
    ).rejects.toThrow(NotFoundError);
    await expect(getTripDetails(owner, "not-a-uuid")).rejects.toThrow(NotFoundError);
  });

  it("refuses participants from another trip", async () => {
    const first = await japanTrip();
    const second = await japanTrip();
    await expect(
      createExpense(owner, first.id, expenseOf([second.participants[0].id])),
    ).rejects.toThrow(NotFoundError);
  });

  it("updates an expense and its participants", async () => {
    const trip = await japanTrip();
    const [paul, lea] = trip.participants;
    const created = await createExpense(owner, trip.id, expenseOf([paul.id, lea.id]));

    await updateExpense(
      owner,
      created.id,
      expenseOf([lea.id], { amountMinor: 5000, exchangeRate: 160 }),
    );

    expect(await getExpense(owner, created.id)).toMatchObject({
      amountMinor: 5000,
      baseAmountMinor: 3125,
      participantIds: [lea.id],
    });
  });

  it("renames and adds participants, but keeps those who share expenses", async () => {
    const trip = await japanTrip();
    const [paul, lea] = trip.participants;
    await createExpense(owner, trip.id, expenseOf([lea.id]));
    const base = { name: trip.name, baseCurrency: "EUR", startDate: null, endDate: null };

    await updateTrip(owner, trip.id, {
      ...base,
      participants: [
        { id: lea.id, name: "Léa M." },
        { id: paul.id, name: "Paul" },
        { name: "Tom" },
      ],
    });
    expect((await getTripDetails(owner, trip.id)).participants.map((p) => p.name)).toEqual([
      "Léa M.",
      "Paul",
      "Tom",
    ]);

    await expect(
      updateTrip(owner, trip.id, { ...base, participants: [{ id: paul.id, name: "Paul" }] }),
    ).rejects.toThrow(new InputError("participantInUse"));
    await expect(
      updateTrip(owner, trip.id, {
        ...base,
        baseCurrency: "USD",
        participants: [{ id: lea.id, name: "Léa" }],
      }),
    ).rejects.toThrow(new InputError("baseCurrencyLocked"));
  });

  it("tracks who paid only when the trip asks for it", async () => {
    const trip = await japanTrip();
    expect(trip.trackPayers).toBe(false);
    await updateTrip(owner, trip.id, {
      name: trip.name,
      baseCurrency: "EUR",
      startDate: null,
      endDate: null,
      trackPayers: true,
      participants: trip.participants.map((p) => ({ id: p.id, name: p.name })),
    });
    expect((await getTripDetails(owner, trip.id)).trackPayers).toBe(true);
  });

  it("stores an optional budget and the daily totals setting", async () => {
    const created = await createTrip(owner, {
      name: "Lisbonne",
      baseCurrency: "EUR",
      startDate: null,
      endDate: null,
      budgetMinor: 80000,
      showDailyTotals: true,
      participants: [{ name: "Paul" }],
    });
    const trip = await getTripDetails(owner, created.id);
    expect(trip).toMatchObject({ budgetMinor: 80000, showDailyTotals: true, trackPayers: false });
    expect((await listTrips(owner)).find((t) => t.id === trip.id)?.budgetMinor).toBe(80000);

    await updateTrip(owner, trip.id, {
      name: trip.name,
      baseCurrency: "EUR",
      startDate: null,
      endDate: null,
      budgetMinor: null,
      participants: trip.participants.map((p) => ({ id: p.id, name: p.name })),
    });
    expect(await getTripDetails(owner, trip.id)).toMatchObject({
      budgetMinor: null,
      showDailyTotals: false,
    });
  });

  it("records who paid and balances the trip", async () => {
    const trip = await japanTrip();
    const [paul, lea] = trip.participants;
    await createExpense(
      owner,
      trip.id,
      expenseOf([paul.id, lea.id], {
        currency: "EUR",
        exchangeRate: null,
        amountMinor: 10000,
        paidBy: lea.id,
      }),
    );
    await createExpense(owner, trip.id, expenseOf([paul.id, lea.id], { currency: "EUR" }));

    const { summary, expenses } = await getTripDetails(owner, trip.id);
    expect(expenses.map((e) => e.paidBy).toSorted()).toEqual([lea.id, null].toSorted());
    expect(Object.fromEntries(summary.balances)).toEqual({ [paul.id]: -5000, [lea.id]: 5000 });
    expect(summary.unpaidCount).toBe(1);
  });

  it("refuses a payer from another trip and keeps participants who paid", async () => {
    const trip = await japanTrip();
    const other = await japanTrip();
    const [paul, lea] = trip.participants;
    await expect(
      createExpense(owner, trip.id, expenseOf([paul.id], { paidBy: other.participants[0].id })),
    ).rejects.toThrow(NotFoundError);

    // Léa paid an expense shared by Paul only: she cannot be removed.
    await createExpense(owner, trip.id, expenseOf([paul.id], { paidBy: lea.id }));
    await expect(
      updateTrip(owner, trip.id, {
        name: trip.name,
        baseCurrency: "EUR",
        startDate: null,
        endDate: null,
        participants: [{ id: paul.id, name: "Paul" }],
      }),
    ).rejects.toThrow(new InputError("participantInUse"));
  });

  it("creates the built-in categories once", async () => {
    const first = await listCategories(owner);
    const second = await listCategories(owner);
    expect(first.map((c) => c.key)).toEqual([
      "transport",
      "lodging",
      "food",
      "activities",
      "groceries",
      "other",
    ]);
    expect(second.map((c) => c.id)).toEqual(first.map((c) => c.id));
  });

  it("deletes a trip with everything in it", async () => {
    const trip = await japanTrip();
    await createExpense(owner, trip.id, expenseOf(trip.participants.map((p) => p.id)));
    await deleteTrip(owner, trip.id);
    await expect(getTripDetails(owner, trip.id)).rejects.toThrow(NotFoundError);
  });
});
