import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { notification, participant, trip, user } from "@/db/schema";
import { accessibleBy } from "./access";

/** Read notifications are kept this long, then deleted. */
const KEEP_READ_MS = 30 * 24 * 60 * 60 * 1000;

/** Tells accounts they were given access to a trip (never the person who did it). */
export async function notifyAddedToTrip(actorId: string, tripId: string, userIds: string[]) {
  const recipients = [...new Set(userIds)].filter((id) => id !== actorId);
  if (recipients.length === 0) return;
  await db
    .insert(notification)
    .values(
      recipients.map((userId) => ({ userId, tripId, actorId, kind: "addedToTrip" as const })),
    );
}

/**
 * Tells everyone else with access to the trip that `actorId` added an expense. Their unread
 * notification for the same trip and person counts one more instead of adding a line.
 */
export async function notifyExpenseAdded(actorId: string, tripId: string) {
  const [owner] = await db.select({ id: trip.userId }).from(trip).where(eq(trip.id, tripId));
  const linked = await db
    .select({ id: participant.userId })
    .from(participant)
    .where(and(eq(participant.tripId, tripId), isNotNull(participant.userId)));
  const recipients = [...new Set([owner?.id, ...linked.map((p) => p.id)])].filter(
    (id): id is string => Boolean(id) && id !== actorId,
  );
  if (recipients.length === 0) return;

  const bumped = await db
    .update(notification)
    .set({ count: sql`${notification.count} + 1`, updatedAt: new Date() })
    .where(
      and(
        inArray(notification.userId, recipients),
        eq(notification.tripId, tripId),
        eq(notification.actorId, actorId),
        eq(notification.kind, "expensesAdded"),
        isNull(notification.readAt),
      ),
    )
    .returning({ userId: notification.userId });
  const fresh = recipients.filter((id) => !bumped.some((b) => b.userId === id));
  if (fresh.length === 0) return;
  await db
    .insert(notification)
    .values(fresh.map((userId) => ({ userId, tripId, actorId, kind: "expensesAdded" as const })));
}

/** Notifications about trips the user can still open. */
function visibleTo(userId: string) {
  return and(eq(notification.userId, userId), accessibleBy(userId), isNull(trip.deletedAt));
}

/** The user's latest notifications, newest first; old read ones are deleted on the way. */
export async function listNotifications(userId: string, limit = 50) {
  await db
    .delete(notification)
    .where(
      and(
        eq(notification.userId, userId),
        lt(notification.readAt, new Date(Date.now() - KEEP_READ_MS)),
      ),
    );
  const actor = alias(user, "actor");
  return db
    .select({
      id: notification.id,
      kind: notification.kind,
      count: notification.count,
      tripId: notification.tripId,
      tripName: trip.name,
      actorName: actor.name,
      updatedAt: notification.updatedAt,
      read: sql<boolean>`${notification.readAt} is not null`,
    })
    .from(notification)
    .innerJoin(trip, eq(trip.id, notification.tripId))
    .leftJoin(actor, eq(actor.id, notification.actorId))
    .where(visibleTo(userId))
    .orderBy(desc(notification.updatedAt))
    .limit(limit);
}

/** How many unread notifications the user has. */
export async function unreadCount(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(notification)
    .innerJoin(trip, eq(trip.id, notification.tripId))
    .where(and(visibleTo(userId), isNull(notification.readAt)));
  return row?.count ?? 0;
}

/** Marks the user's notifications as read: all of them, or those about one trip. */
export async function markRead(userId: string, tripId?: string) {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.userId, userId),
        isNull(notification.readAt),
        tripId ? eq(notification.tripId, tripId) : undefined,
      ),
    );
}

/** Trips with unread notifications for the user, to mark them in the trips list. */
export async function tripsWithNews(userId: string) {
  const rows = await db
    .selectDistinct({ tripId: notification.tripId })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return new Set(rows.map((r) => r.tripId));
}
