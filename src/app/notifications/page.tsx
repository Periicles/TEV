import { BellIcon, UserPlusIcon, ReceiptIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { MarkRead } from "@/components/mark-read";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { listNotifications } from "@/server/notifications";

export default async function NotificationsPage() {
  const { user } = await requireSession();
  const [notifications, t, format] = await Promise.all([
    listNotifications(user.id),
    getTranslations("notifications"),
    getFormatter(),
  ]);
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      {notifications.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-lg border border-dashed p-8 text-center">
          <BellIcon className="size-6 text-muted-foreground" />
          <p className="font-medium">{t("empty")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {notifications.map((n) => {
            const Icon = n.kind === "addedToTrip" ? UserPlusIcon : ReceiptIcon;
            const values = { actor: n.actorName ?? t("someone"), trip: n.tripName, count: n.count };
            return (
              <li key={n.id} data-testid="notification">
                <Link
                  href={`/trips/${n.tripId}`}
                  className="flex items-start gap-3 px-3 py-3 hover:bg-accent/50"
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      n.read ? "text-muted-foreground" : "text-primary",
                    )}
                  />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className={cn("text-sm", !n.read && "font-medium")}>{t(n.kind, values)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format.relativeTime(n.updatedAt, now)}
                    </p>
                  </div>
                  {!n.read && (
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-primary shadow-[0_0_6px_var(--primary-glow)]"
                      aria-label={t("unread")}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {notifications.some((n) => !n.read) && <MarkRead />}
    </main>
  );
}
