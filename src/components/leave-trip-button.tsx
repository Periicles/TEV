"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { leaveTrip } from "@/app/trips/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Lets someone a trip is shared with take their account off it. */
export function LeaveTripButton({ tripId, tripName }: { tripId: string; tripName: string }) {
  const t = useTranslations("members");
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-destructive" loading={pending}>
          <LogOutIcon />
          {t("leave")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("leaveTitle", { name: tripName })}</AlertDialogTitle>
          <AlertDialogDescription>{t("leaveDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => startTransition(() => leaveTrip(tripId))}
          >
            {t("confirmLeave")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
