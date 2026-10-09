"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { toast, Toaster } from "sonner";
import { undoRemoveExpense, undoRemoveTrip } from "@/app/trips/actions";
import type { Flash } from "@/app/flash";

const FLASH_COOKIE = "tev-flash";
/** Long enough to notice a deletion and undo it. */
const UNDO_DURATION_MS = 10_000;

/** Reads and clears the message a server action left for this page. */
function takeFlash(): Flash | null {
  const entry = document.cookie.split("; ").find((c) => c.startsWith(`${FLASH_COOKIE}=`));
  if (!entry) return null;
  document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    return JSON.parse(decodeURIComponent(entry.slice(FLASH_COOKIE.length + 1))) as Flash;
  } catch {
    return null;
  }
}

/** Shows server actions' messages as toasts, with "Undo" after a deletion. */
export function FlashToaster() {
  const t = useTranslations("toasts");
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const message = takeFlash();
    if (!message) return;
    switch (message.kind) {
      case "tripImported":
        toast.success(t("tripImported", { count: message.count }));
        break;
      case "tripDeleted":
        toast(t("tripDeleted"), {
          duration: UNDO_DURATION_MS,
          action: {
            label: t("undo"),
            onClick: async () => {
              const tripId = await undoRemoveTrip(message.id);
              if (!tripId) return void toast.error(t("undoFailed"));
              toast.success(t("tripRestored"));
              router.push(`/trips/${tripId}`);
            },
          },
        });
        break;
      case "expenseDeleted":
        toast(t("expenseDeleted"), {
          duration: UNDO_DURATION_MS,
          action: {
            label: t("undo"),
            onClick: async () => {
              const tripId = await undoRemoveExpense(message.id);
              if (!tripId) return void toast.error(t("undoFailed"));
              toast.success(t("expenseRestored"));
              router.refresh();
            },
          },
        });
        break;
      default:
        toast.success(t(message.kind));
    }
  }, [pathname, router, t]);

  return (
    <Toaster
      // At the bottom, clear of the header's buttons; on phones, above the sticky "Add" bar.
      position="bottom-center"
      mobileOffset={{ bottom: 96 }}
      visibleToasts={2}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      toastOptions={{ className: "font-sans" }}
    />
  );
}
