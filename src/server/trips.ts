import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { category, expense, expenseParticipant, participant, trip, user } from "@/db/schema";
import { convert, isCurrency } from "@/lib/money";
import type { ErrorCode } from "@/i18n/errors";
import { summarizeTrip } from "@/lib/summary";
import { accessibleBy } from "./access";
import { notifyAddedToTrip, notifyExpenseAdded } from "./notifications";

/**
 * Data access for trips and expenses. Every function takes the signed-in user's id and only ever
 * reads or writes the trips that user owns or is a participant of (a participant linked to their
 * account); anything else behaves as if it did not exist. Participants with an account can do
 * everything but delete the trip and link or unlink accounts, which only its owner does.
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
    /** Record who paid each expense and show who owes whom. */
    trackPayers: z.boolean().default(false),
    /** Optional budget, in minor units of the base currency. */
    budgetMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().default(null),
    /** Show each day's total in the expense list. */
    showDailyTotals: z.boolean().default(false),
    participants: z
      .array(
        z.object({
          id: id.optional(),
          name: z.string().trim().min(1).max(50),
          /** Email of the participant's account, which gives them access to the trip. */
          email: z.string().trim().toLowerCase().max(254).nullish(),
        }),
      )
      .min(1)
      .max(20),
  })
  .refine((t) => !t.startDate || !t.endDate || t.startDate <= t.endDate, {
    path: ["endDate"],
    message: "endBeforeStart",
  });
export type TripInput = z.input<typeof tripInput>;

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

/** How long a deleted trip or expense can be restored before it is purged. */
const RESTORE_WINDOW_MS = 60 * 60 * 1000;

async function findTrip(
  userId: string,
  tripId: string,
  { deleted = false, ownerOnly = false } = {},
) {
  if (!id.safeParse(tripId).success) throw new NotFoundError();
  const [row] = await db
    .select()
    .from(trip)
    .where(
      and(
        eq(trip.id, tripId),
        ownerOnly ? eq(trip.userId, userId) : accessibleBy(userId),
        deleted ? isNotNull(trip.deletedAt) : isNull(trip.deletedAt),
      ),
    );
  if (!row) throw new NotFoundError();
  return row;
}

async function findExpense(userId: string, expenseId: string, { deleted = false } = {}) {
  if (!id.safeParse(expenseId).success) throw new NotFoundError();
  const [row] = await db
    .select({ expense, trip })
    .from(expense)
    .innerJoin(trip, eq(expense.tripId, trip.id))
    .where(
      and(
        eq(expense.id, expenseId),
        accessibleBy(userId),
        isNull(trip.deletedAt),
        deleted ? isNotNull(expense.deletedAt) : isNull(expense.deletedAt),
      ),
    );
  if (!row) throw new NotFoundError();
  return row;
}

export async function listTrips(userId: string) {
  const trips = await db
    .select({
      id: trip.id,
      name: trip.name,
      baseCurrency: trip.baseCurrency,
      budgetMinor: trip.budgetMinor,
      startDate: trip.startDate,
      endDate: trip.endDate,
      ownerId: trip.userId,
      ownerName: user.name,
      // Other accounts with access: participants linked to someone else than the owner.
      memberCount:
        sql<number>`(select count(*) from ${participant} where ${participant.tripId} = ${trip.id} and ${participant.userId} <> ${trip.userId})`.mapWith(
          Number,
        ),
      totalMinor: sql<number>`coalesce(sum(${expense.baseAmountMinor}), 0)`.mapWith(Number),
      expenseCount: sql<number>`count(${expense.id})`.mapWith(Number),
    })
    .from(trip)
    .innerJoin(user, eq(user.id, trip.userId))
    .leftJoin(expense, and(eq(expense.tripId, trip.id), isNull(expense.deletedAt)))
    .where(and(accessibleBy(userId), isNull(trip.deletedAt)))
    .groupBy(trip.id, user.name)
    .orderBy(sql`${trip.startDate} desc nulls last`, desc(trip.createdAt));

  const counts = await db
    .select({ tripId: participant.tripId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(participant)
    .innerJoin(trip, eq(participant.tripId, trip.id))
    .where(accessibleBy(userId))
    .groupBy(participant.tripId);
  const participantCount = new Map(counts.map((c) => [c.tripId, c.count]));

  return trips.map(({ memberCount, ...t }) => ({
    ...t,
    participantCount: participantCount.get(t.id) ?? 0,
    /** Whether other accounts can see this trip: it has members, or it is someone else's. */
    shared: memberCount > 0 || t.ownerId !== userId,
  }));
}

export async function getTrip(userId: string, tripId: string) {
  const row = await findTrip(userId, tripId);
  const participants = await db
    .select({
      id: participant.id,
      tripId: participant.tripId,
      name: participant.name,
      position: participant.position,
      userId: participant.userId,
      email: user.email,
    })
    .from(participant)
    .leftJoin(user, eq(user.id, participant.userId))
    .where(eq(participant.tripId, row.id))
    .orderBy(asc(participant.position));
  return { ...row, participants };
}

/**
 * The accounts behind the participants' emails, in the same order (`null` without email). Every
 * email must belong to an account, and an account can only be one participant of a trip.
 */
async function accountsFor(participants: { email?: string | null }[]) {
  const emails = participants.map((p) => p.email || null);
  const wanted = [...new Set(emails.filter((e): e is string => e !== null))];
  if (wanted.length < emails.filter(Boolean).length) throw new InputError("duplicateAccount");
  const found = wanted.length
    ? await db
        .select({ id: user.id, email: sql<string>`lower(${user.email})` })
        .from(user)
        .where(inArray(sql`lower(${user.email})`, wanted))
    : [];
  return emails.map((email) => {
    if (!email) return null;
    const account = found.find((f) => f.email === email);
    if (!account) throw new InputError("userNotFound");
    return account.id;
  });
}

/** A trip with its expenses (newest first) and totals in the base currency. */
export async function getTripDetails(userId: string, tripId: string) {
  const details = await getTrip(userId, tripId);
  const expenses = await db
    .select()
    .from(expense)
    .where(and(eq(expense.tripId, details.id), isNull(expense.deletedAt)))
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
  const accounts = await accountsFor(data.participants);
  const created = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(trip)
      .values({
        userId,
        name: data.name,
        baseCurrency: data.baseCurrency,
        startDate: data.startDate,
        endDate: data.endDate,
        trackPayers: data.trackPayers,
        budgetMinor: data.budgetMinor,
        showDailyTotals: data.showDailyTotals,
      })
      .returning();
    await tx.insert(participant).values(
      data.participants.map((p, position) => ({
        tripId: created.id,
        name: p.name,
        position,
        userId: accounts[position],
      })),
    );
    return created;
  });
  await notifyAddedToTrip(
    userId,
    created.id,
    accounts.filter((a): a is string => a !== null),
  );
  return created;
}

export async function updateTrip(userId: string, tripId: string, input: TripInput) {
  const data = tripInput.parse(input);
  const current = await getTrip(userId, tripId);
  // Only the owner links or unlinks accounts: for anyone else, participants keep theirs.
  const isOwner = current.userId === userId;
  const accounts = isOwner
    ? await accountsFor(data.participants)
    : data.participants.map((p) => current.participants.find((c) => c.id === p.id)?.userId ?? null);

  const updated = await db.transaction(async (tx) => {
    // Deleted expenses could not be restored into a trip whose currency or participants changed.
    await tx
      .delete(expense)
      .where(and(eq(expense.tripId, current.id), isNotNull(expense.deletedAt)));

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
      // Their expenses' split (or who paid them) would no longer add up.
      if (shares.length > 0) throw new InputError("participantShares");
      if (payments.length > 0) throw new InputError("participantPaid");
      await tx.delete(participant).where(inArray(participant.id, removed));
    }

    // Accounts may move between participants: unlink them all first (one account per trip).
    await tx.update(participant).set({ userId: null }).where(eq(participant.tripId, current.id));
    for (const [position, p] of data.participants.entries()) {
      const linked = accounts[position];
      if (p.id) {
        await tx
          .update(participant)
          .set({ name: p.name, position, userId: linked })
          .where(eq(participant.id, p.id));
      } else {
        await tx
          .insert(participant)
          .values({ tripId: current.id, name: p.name, position, userId: linked });
      }
    }

    const [updated] = await tx
      .update(trip)
      .set({
        name: data.name,
        baseCurrency: data.baseCurrency,
        startDate: data.startDate,
        endDate: data.endDate,
        trackPayers: data.trackPayers,
        budgetMinor: data.budgetMinor,
        showDailyTotals: data.showDailyTotals,
      })
      .where(eq(trip.id, current.id))
      .returning();
    return updated;
  });
  // Tell the accounts that were just given access.
  const before = new Set(current.participants.map((p) => p.userId));
  await notifyAddedToTrip(
    userId,
    current.id,
    accounts.filter((a): a is string => a !== null && !before.has(a)),
  );
  return updated;
}

/** Deletes for good what was deleted longer ago than the restore window, in the user's trips. */
async function purgeDeleted(userId: string) {
  const cutoff = new Date(Date.now() - RESTORE_WINDOW_MS);
  await db.delete(trip).where(and(eq(trip.userId, userId), lt(trip.deletedAt, cutoff)));
  await db
    .delete(expense)
    .where(
      and(
        lt(expense.deletedAt, cutoff),
        inArray(expense.tripId, db.select({ id: trip.id }).from(trip).where(accessibleBy(userId))),
      ),
    );
}

/** Deletes a trip (owner only); it can be restored with `restoreTrip` during the restore window. */
export async function deleteTrip(userId: string, tripId: string) {
  const current = await findTrip(userId, tripId, { ownerOnly: true });
  await db.update(trip).set({ deletedAt: new Date() }).where(eq(trip.id, current.id));
  await purgeDeleted(userId);
}

export async function restoreTrip(userId: string, tripId: string) {
  const current = await findTrip(userId, tripId, { deleted: true, ownerOnly: true });
  await db.update(trip).set({ deletedAt: null }).where(eq(trip.id, current.id));
  return current.id;
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

/**
 * Checks references and computes the amount in the trip's base currency. A shared trip uses its
 * owner's categories, so everyone sorts expenses the same way.
 */
async function prepareExpense(
  target: { id: string; userId: string; baseCurrency: string },
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
      .where(and(eq(category.id, data.categoryId), eq(category.userId, target.userId)));
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
  const { values, participantIds } = await prepareExpense(target, input);
  const created = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(expense)
      .values({ ...values, tripId: target.id })
      .returning();
    await tx
      .insert(expenseParticipant)
      .values(participantIds.map((participantId) => ({ expenseId: created.id, participantId })));
    return created;
  });
  await notifyExpenseAdded(userId, target.id);
  return created;
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
  const { values, participantIds } = await prepareExpense(found.trip, input);
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

/** Deletes an expense; it can be restored with `restoreExpense` during the restore window. */
export async function deleteExpense(userId: string, expenseId: string) {
  const found = await findExpense(userId, expenseId);
  await db.update(expense).set({ deletedAt: new Date() }).where(eq(expense.id, found.expense.id));
  await purgeDeleted(userId);
  return found.trip.id;
}

export async function restoreExpense(userId: string, expenseId: string) {
  const found = await findExpense(userId, expenseId, { deleted: true });
  await db.update(expense).set({ deletedAt: null }).where(eq(expense.id, found.expense.id));
  return found.trip.id;
}

/** Unlinks the user's account from a trip shared with them: they no longer see it. */
export async function leaveTrip(userId: string, tripId: string) {
  const current = await findTrip(userId, tripId);
  // The owner deletes their trip instead.
  if (current.userId === userId) throw new NotFoundError();
  await db
    .update(participant)
    .set({ userId: null })
    .where(and(eq(participant.tripId, current.id), eq(participant.userId, userId)));
}
