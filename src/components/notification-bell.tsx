import { BellIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

/** The header's link to notifications, with how many are unread. */
export async function NotificationBell({ unread }: { unread: number }) {
  const t = await getTranslations("notifications");
  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href="/notifications" aria-label={t("bell", { count: unread })}>
        <BellIcon />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground shadow-[0_0_8px_var(--primary-glow)]"
            data-testid="unread-count"
            aria-hidden="true"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
