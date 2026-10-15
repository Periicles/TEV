import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { trip } from "./trips";

/**
 * What happened on a shared trip, for one account: someone gave them access, or added expenses.
 * Expenses added by the same person to the same trip are counted on one notification until it is
 * read, so a busy day reads "Léa added 5 expenses" rather than five lines.
 */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Who the notification is for. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    /** Who did it; `null` once their account is deleted. */
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["addedToTrip", "expensesAdded"] }).notNull(),
    /** How many expenses, for `expensesAdded`. */
    count: integer("count").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    readAt: timestamp("read_at"),
  },
  (table) => [index("notification_user_idx").on(table.userId, table.updatedAt)],
);
