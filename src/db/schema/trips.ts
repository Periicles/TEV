import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const trip = pgTable(
  "trip",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** ISO 4217 code every expense is converted into. */
    baseCurrency: char("base_currency", { length: 3 }).notNull().default("EUR"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    /** Whether expenses record who paid them, to work out who owes whom. Off by default. */
    trackPayers: boolean("track_payers").notNull().default(false),
    /** Optional budget, in minor units of the base currency. */
    budgetMinor: bigint("budget_minor", { mode: "number" }),
    /** Whether the expense list shows each day's total. Off by default. */
    showDailyTotals: boolean("show_daily_totals").notNull().default(false),
    /** Set when deleted: the trip can be restored for a while, then it is purged. */
    deletedAt: timestamp("deleted_at"),
    ...timestamps,
  },
  (table) => [
    index("trip_user_id_idx").on(table.userId),
    check("trip_budget_positive", sql`${table.budgetMinor} > 0`),
  ],
);

/** People sharing a trip's expenses. Their count divides the totals. */
export const participant = pgTable(
  "participant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Display order, also used to hand out rounding remainders deterministically. */
    position: integer("position").notNull(),
  },
  (table) => [index("participant_trip_idx").on(table.tripId)],
);

/**
 * Expense categories, shared by all of a user's trips. Built-in ones have a `key` translated in the
 * UI; the ones the user adds have a `name`.
 */
export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key"),
    name: text("name"),
    position: integer("position").notNull(),
    /** Chart color, 1 to 8 (`--chart-N`); `null` follows the position in the palette. */
    color: integer("color"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("category_user_key_idx").on(table.userId, table.key),
    check("category_key_or_name", sql`(${table.key} IS NULL) <> (${table.name} IS NULL)`),
    check("category_color_range", sql`${table.color} BETWEEN 1 AND 8`),
  ],
);

export const expense = pgTable(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    label: text("label").notNull(),
    categoryId: uuid("category_id").references(() => category.id, { onDelete: "set null" }),
    /** Amount paid, in minor units of `currency`. */
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    /** Amount in minor units of the trip's base currency, fixed when the expense is saved. */
    baseAmountMinor: bigint("base_amount_minor", { mode: "number" }).notNull(),
    /** Units of `currency` for one unit of the base currency (1 EUR = 161.56 JPY → 161.56). */
    exchangeRate: numeric("exchange_rate", { precision: 20, scale: 10 }).notNull(),
    /** `official`: fetched from the rates API for the expense's date; `manual`: typed in. */
    rateSource: text("rate_source", { enum: ["same", "manual", "official"] }).notNull(),
    /**
     * Participant who paid, for settling up; `null` when unknown (expenses entered or imported
     * before it was tracked), which leaves the expense out of the balances.
     */
    paidBy: uuid("paid_by").references(() => participant.id, { onDelete: "set null" }),
    paymentMethod: text("payment_method"),
    notes: text("notes"),
    /** Set when deleted: the expense can be restored for a while, then it is purged. */
    deletedAt: timestamp("deleted_at"),
    ...timestamps,
  },
  (table) => [
    index("expense_trip_date_idx").on(table.tripId, table.date),
    check("expense_amount_positive", sql`${table.amountMinor} > 0`),
    check("expense_base_amount_positive", sql`${table.baseAmountMinor} > 0`),
    check("expense_rate_positive", sql`${table.exchangeRate} > 0`),
  ],
);

/** Participants an expense is split between, in equal shares. */
export const expenseParticipant = pgTable(
  "expense_participant",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expense.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.expenseId, table.participantId] }),
    index("expense_participant_participant_idx").on(table.participantId),
  ],
);

export const tripRelations = relations(trip, ({ many }) => ({
  participants: many(participant),
  expenses: many(expense),
}));

export const participantRelations = relations(participant, ({ one }) => ({
  trip: one(trip, { fields: [participant.tripId], references: [trip.id] }),
}));

export const expenseRelations = relations(expense, ({ one, many }) => ({
  trip: one(trip, { fields: [expense.tripId], references: [trip.id] }),
  category: one(category, { fields: [expense.categoryId], references: [category.id] }),
  payer: one(participant, { fields: [expense.paidBy], references: [participant.id] }),
  participants: many(expenseParticipant),
}));

export const expenseParticipantRelations = relations(expenseParticipant, ({ one }) => ({
  expense: one(expense, { fields: [expenseParticipant.expenseId], references: [expense.id] }),
  participant: one(participant, {
    fields: [expenseParticipant.participantId],
    references: [participant.id],
  }),
}));

/**
 * Official rates already fetched, keyed by the date asked for (a weekend maps to the last published
 * rate, kept in `rateDate`). Past rates never change, so each one is fetched once.
 */
export const exchangeRate = pgTable(
  "exchange_rate",
  {
    requestedDate: date("requested_date").notNull(),
    base: char("base", { length: 3 }).notNull(),
    quote: char("quote", { length: 3 }).notNull(),
    /** Units of `quote` for one unit of `base`. */
    rate: numeric("rate", { precision: 20, scale: 10 }).notNull(),
    rateDate: date("rate_date").notNull(),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.requestedDate, table.base, table.quote] })],
);
