"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/app/notifications/actions";

/** Once the page is shown, marks its notifications as read (those about `tripId` when given). */
export function MarkRead({ tripId }: { tripId?: string }) {
  useEffect(() => {
    void markNotificationsRead(tripId);
  }, [tripId]);
  return null;
}
