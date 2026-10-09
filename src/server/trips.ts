import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { category, expense, expenseParticipant, participant, trip } from "@/db/schema";
import { convert, isCurrency } from "@/lib/money";
import type { ErrorCode } from "@/i18n/errors";
import { summarizeTrip } from "@/lib/summary";

/**
 * Data access for trips and expenses. Every function takes the signed-in user's id and only ever
 * reads or writes that user's rows; anything else behaves as if it did not exist.
 */

export const DEFAULT_CATEGORY_KEYS = [
  "transport",
  "lodging",
  "food",
  "activities",
  "groceries",
  "other",
] as const;

export class NotFoundError extends Error {
  constructor() {
    super("Not found");
  }
}

/** A rule the input breaks; `code` is a translation key under `errors`. */
export class InputError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}

const id = z.uuid();
const isoDate = z.iso.date();
const currencyCode = z.string().refine(isCurrency, "invalidCurrency");

export const tripInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    baseCurrency: currencyCode,
    startDate: isoDate.nullable(),
    endDate: isoDate.nullable(),
    participants: z
      .array(z.object({ id: id.optional(), name: z.string().trim().min(1).max(50) }))
      .min(1)
      .max(20),
  })
  .refine((t) => !t.startDate || !t.endDate || t.startDate <= t.endDate, {
    path: ["endDate"],
    message: "endBeforeStart",
  });
export type TripInput = z.infer<typeof tripInput>;

export const expenseInput = z.object({
  date: isoDate,
  label: z.string().trim().min(1).max(200),
  amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  currency: currencyCode,
  /** Units of `currency` for one unit of the trip's base currency; required for a foreign currency. */
  exchangeRate: z.number().positive().finite().nullable(),
  /** Whether `exchangeRate` is the official rate for `date` (checked by the caller) or typed in. */
  rateSource: z.enum(["manual", "official"]).optional(),
  categoryId: id.nullable(),
  paymentMethod: z.string().trim().max(50).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  participantIds: z.array(id).min(1),
  /** Participant who paid; `null` when unknown, which leaves the expense out of settling up. */
  paidBy: id.nullable(),
});
export type ExpenseInput = z.infer<typeof expenseInput>;

async function findTrip(userId: string, tripId: string) {
  if (!id.safeParse(tripId).success) throw new NotFoundError();
  const [row] = await db
    .select()
    .from(trip)
    .where(and(eq(trip.id, tripId), eq(trip.userId, userId)));
  if (!row) throw new NotFoundError();
  return row;
}

async function findExpense(userId: string, expenseId: string) {
  if (!id.safeParse(expenseId).success) throw new NotFoundError();
  const [row] = await db
    .select({ expense, trip })
    .from(expense)
    .innerJoin(trip, eq(expense.tripId, trip.id))
    .where(and(eq(expense.id, expenseId), eq(trip.userId, userId)));
  if (!row) throw new NotFoundError();
  return row;
}

export async function listTrips(userId: string) {
  const trips = await db
    .select({
      id: trip.id,
      name: trip.name,
      baseCurrency: trip.baseCurrency,
      startDate: trip.startDate,
      endDate: trip.endDate,
      totalMinor: sql<number>`coalesce(sum(${expense.baseAmountMinor}), 0)`.mapWith(Number),
      expenseCount: sql<number>`count(${expense.id})`.mapWith(Number),
    })
    .from(trip)
    .leftJoin(expense, eq(expense.tripId, trip.id))
    .where(eq(trip.userId, userId))
    .groupBy(trip.id)
    .orderBy(sql`${trip.startDate} desc nulls last`, desc(trip.createdAt));

  const counts = await db
    .select({ tripId: participant.tripId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(participant)
    .innerJoin(trip, eq(participant.tripId, trip.id))
    .where(eq(trip.userId, userId))
    .groupBy(participant.tripId);
  const participantCount = new Map(counts.map((c) => [c.tripId, c.count]));

  return trips.map((t) => ({ ...t, participantCount: participantCount.get(t.id) ?? 0 }));
}

export async function getTrip(userId: string, tripId: string) {
  const row = await findTrip(userId, tripId);
  const participants = await db
    .select()
    .from(participant)
    .where(eq(participant.tripId, row.id))
    .orderBy(asc(participant.position));
  return { ...row, participants };
}

/** A trip with its expenses (newest first) and totals in the base currency. */
export async function getTripDetails(userId: string, tripId: string) {
  const details = await getTrip(userId, tripId);
  const expenses = await db
    .select()
    .from(expense)
    .where(eq(expense.tripId, details.id))
    .orderBy(desc(expense.date), desc(expense.createdAt));
  const shares = expenses.length
    ? await db
        .select()
        .from(expenseParticipant)
        .where(
          inArray(
            expenseParticipant.expenseId,
            expenses.map((e) => e.id),
          ),
        )
    : [];

  const withParticipants = expenses.map((e) => ({
    ...e,
    participantIds: shares.filter((s) => s.expenseId === e.id).map((s) => s.participantId),
  }));
  return {
    ...details,
    expenses: withParticipants,
    summary: summarizeTrip(details.participants, withParticipants),
  };
}

export async function createTrip(userId: string, input: TripInput) {
  const data = tripInput.parse(input);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(trip)
      .values({
        userId,
        name: data.name,
        baseCurrency: data.baseCurrency,
        startDate: data.startDate,
        endDate: data.endDate,
      })
      .returning();
    await tx
      .insert(participant)
      .values(
        data.participants.map((p, position) => ({ tripId: created.id, name: p.name, position })),
      );
    return created;
  });
}

export async function updateTrip(userId: string, tripId: string, input: TripInput) {
  const data = tripInput.parse(input);
  const current = await getTrip(userId, tripId);

  return db.transaction(async (tx) => {
    if (data.baseCurrency !== current.baseCurrency) {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(expense)
        .where(eq(expense.tripId, current.id));
      // Converted amounts were computed for the previous base currency.
      if (count > 0) throw new InputError("baseCurrencyLocked");
    }

    const kept = new Set(data.participants.flatMap((p) => (p.id ? [p.id] : [])));
    if ([...kept].some((pid) => !current.participants.some((p) => p.id === pid))) {
      throw new NotFoundError();
    }
    const removed = current.participants.filter((p) => !kept.has(p.id)).map((p) => p.id);
    if (removed.length > 0) {
      const [shares, payments] = await Promise.all([
        tx
          .select({ id: expenseParticipant.participantId })
          .from(expenseParticipant)
          .where(inArray(expenseParticipant.participantId, removed))
          .limit(1),
        tx
          .select({ id: expense.id })
          .from(expense)
          .where(inArray(expense.paidBy, removed))
          .limit(1),
      ]);
      if (shares.length > 0 || payments.length > 0) throw new InputError("participantInUse");
      await tx.delete(participant).where(inArray(participant.id, removed));
    }

    for (const [position, p] of data.participants.entries()) {
      if (p.id) {
        await tx
          .update(participant)
          .set({ name: p.name, position })
          .where(eq(participant.id, p.id));
      } else {
        await tx.insert(participant).values({ tripId: current.id, name: p.name, position });
      }
    }

    const [updated] = await tx
      .update(trip)
      .set({
        name: data.name,
        baseCurrency: data.baseCurrency,
        startDate: data.startDate,
        endDate: data.endDate,
      })
      .where(eq(trip.id, current.id))
      .returning();
    return updated;
  });
}

export async function deleteTrip(userId: string, tripId: string) {
  const current = await findTrip(userId, tripId);
  await db.delete(trip).where(eq(trip.id, current.id));
}

/** The user's categories, creating the built-in ones on first use. */
export async function listCategories(userId: string) {
  const existing = await db
    .select()
    .from(category)
    .where(eq(category.userId, userId))
    .orderBy(asc(category.position));
  if (existing.length > 0) return existing;

  await db
    .insert(category)
    .values(DEFAULT_CATEGORY_KEYS.map((key, position) => ({ userId, key, position })))
    .onConflictDoNothing();
  return db
    .select()
    .from(category)
    .where(eq(category.userId, userId))
    .orderBy(asc(category.position));
}

/** Checks references and computes the amount in the trip's base currency. */
async function prepareExpense(
  userId: string,
  target: { id: string; baseCurrency: string },
  input: ExpenseInput,
) {
  const data = expenseInput.parse(input);

  const tripParticipants = await db
    .select({ id: participant.id })
    .from(participant)
    .where(eq(participant.tripId, target.id));
  const allowed = new Set(tripParticipants.map((p) => p.id));
  if (!data.participantIds.every((pid) => allowed.has(pid))) throw new NotFoundError();
  if (data.paidBy && !allowed.has(data.paidBy)) throw new NotFoundError();

  if (data.categoryId) {
    const [owned] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.id, data.categoryId), eq(category.userId, userId)));
    if (!owned) throw new NotFoundError();
  }

  const sameCurrency = data.currency === target.baseCurrency;
  if (!sameCurrency && data.exchangeRate === null) throw new InputError("rateRequired");
  const rate = sameCurrency ? 1 : data.exchangeRate!;
  const baseAmountMinor = convert(data.amountMinor, data.currency, rate, target.baseCurrency);
  if (baseAmountMinor < 1) throw new InputError("amountTooSmall");

  return {
    values: {
      date: data.date,
      label: data.label,
      categoryId: data.categoryId,
      amountMinor: data.amountMinor,
      currency: data.currency,
      baseAmountMinor,
      exchangeRate: String(rate),
      rateSource: sameCurrency ? ("same" as const) : (data.rateSource ?? "manual"),
      paidBy: data.paidBy,
      paymentMethod: data.paymentMethod || null,
      notes: data.notes || null,
    },
    participantIds: [...new Set(data.participantIds)],
  };
}

export async function createExpense(userId: string, tripId: string, input: ExpenseInput) {
  const target = await findTrip(userId, tripId);
  const { values, participantIds } = await prepareExpense(userId, target, input);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(expense)
      .values({ ...values, tripId: target.id })
      .returning();
    await tx
      .insert(expenseParticipant)
      .values(participantIds.map((participantId) => ({ expenseId: created.id, participantId })));
    return created;
  });
}

export async function getExpense(userId: string, expenseId: string) {
  const found = await findExpense(userId, expenseId);
  const shares = await db
    .select({ participantId: expenseParticipant.participantId })
    .from(expenseParticipant)
    .where(eq(expenseParticipant.expenseId, found.expense.id));
  return { ...found.expense, participantIds: shares.map((s) => s.participantId) };
}

export async function updateExpense(userId: string, expenseId: string, input: ExpenseInput) {
  const found = await findExpense(userId, expenseId);
  const { values, participantIds } = await prepareExpense(userId, found.trip, input);
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(expense)
      .set(values)
      .where(eq(expense.id, found.expense.id))
      .returning();
    await tx.delete(expenseParticipant).where(eq(expenseParticipant.expenseId, updated.id));
    await tx
      .insert(expenseParticipant)
      .values(participantIds.map((participantId) => ({ expenseId: updated.id, participantId })));
    return updated;
  });
}

export async function deleteExpense(userId: string, expenseId: string) {
  const found = await findExpense(userId, expenseId);
  await db.delete(expense).where(eq(expense.id, found.expense.id));
  return found.trip.id;
}
