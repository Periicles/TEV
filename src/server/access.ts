import { and, eq, exists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { participant, trip } from "@/db/schema";

/** Trips the user owns or is a participant of. */
export function accessibleBy(userId: string) {
  return or(
    eq(trip.userId, userId),
    exists(
      db
        .select({ one: sql`1` })
        .from(participant)
        .where(and(eq(participant.tripId, trip.id), eq(participant.userId, userId))),
    ),
  );
}
