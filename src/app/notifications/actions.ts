"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { markRead } from "@/server/notifications";

/** Marks the user's notifications as read (only those about `tripId` when given). */
export async function markNotificationsRead(tripId?: string) {
  const { user } = await requireSession();
  await markRead(user.id, tripId);
  // The bell in the header and the "new" marks in the trips list follow.
  revalidatePath("/", "layout");
}
