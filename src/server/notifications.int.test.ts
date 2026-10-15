import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { user } from "@/db/schema";
import { createUser } from "@/lib/users";
import { listNotifications, markRead, tripsWithNews, unreadCount } from "./notifications";
import { createExpense, createTrip, getTripDetails, leaveTrip, updateTrip } from "./trips";

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emails = [
  `notif-paul-${run}@test.local`,
  `notif-lea-${run}@test.local`,
  `notif-max-${run}@test.local`,
];
let paul: string;
let lea: string;
let max: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  paul = (await createUser({ email: emails[0], name: "Paul", password: "a-long-password" })).id;
  lea = (await createUser({ email: emails[1], name: "Léa", password: "a-long-password" })).id;
  max = (await createUser({ email: emails[2], name: "Max", password: "a-long-password" })).id;
});

afterAll(async () => {
  if (process.env.DATABASE_URL) await db.delete(user).where(inArray(user.email, emails));
});

const base = { name: "Japon", baseCurrency: "EUR", startDate: null, endDate: null };

async function expenseBy(userId: string, tripId: string) {
  const trip = await getTripDetails(userId, tripId);
  return createExpense(userId, tripId, {
    date: "2025-03-20",
    label: "Ramen",
    amountMinor: 1500,
    currency: "EUR",
    exchangeRate: null,
    categoryId: null,
    paymentMethod: null,
    notes: null,
    participantIds: trip.participants.map((p) => p.id),
    paidBy: null,
  });
}

describe.skipIf(!process.env.DATABASE_URL)("notifications", () => {
  it("tells people about shared trips and new expenses, without echoing their own", async () => {
    const trip = await createTrip(paul, {
      ...base,
      participants: [
        { name: "Paul", email: emails[0] },
        { name: "Léa", email: emails[1] },
      ],
    });
    expect(await unreadCount(paul)).toBe(0);
    expect(await listNotifications(lea)).toMatchObject([
      { kind: "addedToTrip", actorName: "Paul", tripName: "Japon", read: false },
    ]);

    // Two expenses by Léa make one notification for Paul, counting both.
    await expenseBy(lea, trip.id);
    await expenseBy(lea, trip.id);
    expect(await listNotifications(paul)).toMatchObject([
      { kind: "expensesAdded", actorName: "Léa", count: 2, read: false },
    ]);
    expect(await tripsWithNews(paul)).toEqual(new Set([trip.id]));
    expect(await unreadCount(lea)).toBe(1);

    // Once read, the next expense starts a new notification.
    await markRead(paul, trip.id);
    expect(await unreadCount(paul)).toBe(0);
    await expenseBy(lea, trip.id);
    const [latest, earlier] = await listNotifications(paul);
    expect(latest).toMatchObject({ count: 1, read: false });
    expect(earlier).toMatchObject({ count: 2, read: true });
  });

  it("tells only the accounts that were just given access", async () => {
    const created = await createTrip(paul, {
      ...base,
      participants: [{ name: "Paul" }, { name: "Léa", email: emails[1] }, { name: "Max" }],
    });
    const trip = await getTripDetails(paul, created.id);
    await markRead(lea);
    await updateTrip(paul, trip.id, {
      ...base,
      participants: trip.participants.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.name === "Max" ? emails[2] : p.email,
      })),
    });
    expect(await unreadCount(lea)).toBe(0);
    expect((await listNotifications(max)).filter((n) => n.tripId === trip.id)).toMatchObject([
      { kind: "addedToTrip", actorName: "Paul" },
    ]);
  });

  it("hides notifications about trips the user left", async () => {
    const trip = await createTrip(paul, {
      ...base,
      participants: [{ name: "Paul" }, { name: "Léa", email: emails[1] }],
    });
    expect((await listNotifications(lea)).some((n) => n.tripId === trip.id)).toBe(true);
    await leaveTrip(lea, trip.id);
    expect((await listNotifications(lea)).some((n) => n.tripId === trip.id)).toBe(false);
  });
});
