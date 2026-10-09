import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { category, expense, expenseParticipant, participant, trip } from "@/db/schema";
import { listCategories, NotFoundError, tripInput } from "@/server/trips";

/**
 * Creates a trip with all its expenses at once, from a spreadsheet converted in the browser
 * (`src/lib/spreadsheet.ts`). Amounts are in the trip's base currency and split between all its
 * participants, as in the spreadsheet; either everything is saved or nothing is.
 */

const MAX_EXPENSES = 5000;
/** Rows per INSERT, well below PostgreSQL's limit on query parameters. */
const CHUNK = 500;

export const importInput = z.object({
  trip: tripInput,
  /** Categories to create, referenced by index from the expenses. */
  newCategories: z.array(z.string().trim().min(1).max(50)).max(50),
  expenses: z
    .array(
      z.object({
        date: z.iso.date(),
        label: z.string().trim().min(1).max(200),
        amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        categoryId: z.uuid().nullable(),
        newCategory: z.number().int().nonnegative().nullable(),
        notes: z.string().trim().max(1000).nullable(),
      }),
    )
    .min(1)
    .max(MAX_EXPENSES),
});
export type ImportInput = z.infer<typeof importInput>;

function chunks<T>(items: T[]) {
  return Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK),
  );
}

export async function importTrip(userId: string, input: ImportInput) {
  const data = importInput.parse(input);
  // Built-in categories exist before expenses point to them.
  const existing = await listCategories(userId);
  const owned = new Set(existing.map((c) => c.id));
  for (const e of data.expenses) {
    if (e.categoryId && !owned.has(e.categoryId)) throw new NotFoundError();
    if (e.newCategory !== null && e.newCategory >= data.newCategories.length) {
      throw new NotFoundError();
    }
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(trip)
      .values({
        userId,
        name: data.trip.name,
        baseCurrency: data.trip.baseCurrency,
        startDate: data.trip.startDate,
        endDate: data.trip.endDate,
      })
      .returning();
    const participants = await tx
      .insert(participant)
      .values(
        data.trip.participants.map((p, position) => ({
          tripId: created.id,
          name: p.name,
          position,
        })),
      )
      .returning({ id: participant.id });

    let categoryIds: string[] = [];
    if (data.newCategories.length > 0) {
      const [{ last }] = await tx
        .select({ last: sql<number>`coalesce(max(${category.position}), -1)`.mapWith(Number) })
        .from(category)
        .where(eq(category.userId, userId));
      const inserted = await tx
        .insert(category)
        .values(
          data.newCategories.map((name, index) => ({ userId, name, position: last + 1 + index })),
        )
        .returning({ id: category.id });
      categoryIds = inserted.map((c) => c.id);
    }

    const values = data.expenses.map((e) => ({
      tripId: created.id,
      date: e.date,
      label: e.label,
      categoryId: e.newCategory !== null ? categoryIds[e.newCategory] : e.categoryId,
      amountMinor: e.amountMinor,
      currency: data.trip.baseCurrency,
      baseAmountMinor: e.amountMinor,
      exchangeRate: "1",
      rateSource: "same" as const,
      notes: e.notes || null,
    }));
    for (const chunk of chunks(values)) {
      const expenses = await tx.insert(expense).values(chunk).returning({ id: expense.id });
      const shares = expenses.flatMap((e) =>
        participants.map((p) => ({ expenseId: e.id, participantId: p.id })),
      );
      for (const part of chunks(shares)) await tx.insert(expenseParticipant).values(part);
    }
    return created;
  });
}
