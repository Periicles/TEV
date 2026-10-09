import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { category, trip, user } from "@/db/schema";
import { createUser } from "@/lib/users";
import { importTrip, type ImportInput } from "./import";
import { getTripDetails, listCategories, NotFoundError } from "./trips";

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emails = [`import-${run}@test.local`, `import-other-${run}@test.local`];
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

function input(overrides: Partial<ImportInput> = {}): ImportInput {
  return {
    trip: {
      name: "Japon 2025",
      baseCurrency: "EUR",
      startDate: null,
      endDate: null,
      participants: [{ name: "Paul" }, { name: "Léa" }],
    },
    paidBy: null,
    newCategories: [],
    expenses: [],
    ...overrides,
  };
}

describe.skipIf(!process.env.DATABASE_URL)("spreadsheet import", () => {
  it("creates the trip, its new categories and its expenses split between everyone", async () => {
    const transport = (await listCategories(owner)).find((c) => c.key === "transport")!;
    const created = await importTrip(
      owner,
      input({
        paidBy: 1,
        newCategories: ["Extras"],
        expenses: [
          {
            date: "2025-03-20",
            label: "Shinkansen",
            amountMinor: 17539,
            categoryId: transport.id,
            newCategory: null,
            notes: null,
          },
          {
            date: "2025-03-20",
            label: "Sushiro",
            amountMinor: 2383,
            categoryId: null,
            newCategory: 0,
            notes: "Kaiten",
          },
          {
            date: "2025-03-28",
            label: "Suica",
            amountMinor: 7435,
            categoryId: null,
            newCategory: 0,
            notes: null,
          },
        ],
      }),
    );

    const details = await getTripDetails(owner, created.id);
    expect(details.participants.map((p) => p.name)).toEqual(["Paul", "Léa"]);
    expect(details.summary.totalMinor).toBe(17539 + 2383 + 7435);
    for (const e of details.expenses) {
      expect(e).toMatchObject({ currency: "EUR", rateSource: "same" });
      expect(e.baseAmountMinor).toBe(e.amountMinor);
      expect(e.participantIds).toHaveLength(2);
      expect(e.paidBy).toBe(details.participants[1].id);
    }
    // Choosing a payer turns payer tracking on for the trip.
    expect(details.trackPayers).toBe(true);
    for (const e of details.expenses) {
    }

    const categories = await listCategories(owner);
    const extras = categories.filter((c) => c.name === "Extras");
    expect(extras).toHaveLength(1);
    // New categories come after the existing ones.
    expect(extras[0].position).toBe(Math.max(...categories.map((c) => c.position)));
    const sushi = details.expenses.find((e) => e.label === "Sushiro")!;
    expect(sushi).toMatchObject({ categoryId: extras[0].id, notes: "Kaiten" });
    expect(details.expenses.find((e) => e.label === "Suica")!.categoryId).toBe(extras[0].id);
    expect(details.expenses.find((e) => e.label === "Shinkansen")!.categoryId).toBe(transport.id);
  });

  it("imports large spreadsheets in several batches", async () => {
    const expenses = Array.from({ length: 1201 }, (_, i) => ({
      date: "2025-03-20",
      label: `Dépense ${i}`,
      amountMinor: 100,
      categoryId: null,
      newCategory: null,
      notes: null,
    }));
    const created = await importTrip(owner, input({ expenses }));
    const details = await getTripDetails(owner, created.id);
    expect(details.expenses).toHaveLength(1201);
    expect(details.trackPayers).toBe(false);
    expect(details.summary.totalMinor).toBe(120100);
  });

  it("refuses a payer who is not among the participants", async () => {
    await expect(
      importTrip(
        owner,
        input({
          paidBy: 2,
          expenses: [
            {
              date: "2025-03-20",
              label: "Bus",
              amountMinor: 300,
              categoryId: null,
              newCategory: null,
              notes: null,
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses someone else's category and saves nothing", async () => {
    const theirs = (await listCategories(other))[0];
    const before = await db.select().from(trip).where(eq(trip.userId, owner));
    await expect(
      importTrip(
        owner,
        input({
          expenses: [
            {
              date: "2025-03-20",
              label: "Bus",
              amountMinor: 300,
              categoryId: theirs.id,
              newCategory: null,
              notes: null,
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      importTrip(
        owner,
        input({
          expenses: [
            {
              date: "2025-03-20",
              label: "Bus",
              amountMinor: 300,
              categoryId: null,
              newCategory: 3,
              notes: null,
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    const after = await db.select().from(trip).where(eq(trip.userId, owner));
    expect(after).toHaveLength(before.length);
  });

  it("checks every row before saving anything", async () => {
    const before = await db.select().from(category).where(eq(category.userId, owner));
    await expect(
      importTrip(
        owner,
        input({
          newCategories: ["Souvenirs"],
          expenses: [
            {
              date: "2025-03-20",
              label: "Bus",
              amountMinor: 0,
              categoryId: null,
              newCategory: 0,
              notes: null,
            },
          ],
        }),
      ),
    ).rejects.toThrow();
    const after = await db.select().from(category).where(eq(category.userId, owner));
    expect(after).toHaveLength(before.length);
  });
});
