"use client";

import { UserMinusIcon, UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addTripMember, leaveTrip, removeTripMember } from "@/app/trips/actions";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ErrorCode } from "@/i18n/errors";

export interface Member {
  id: string;
  name: string;
  email: string;
}

/** A confirmation dialog behind a button, for removing someone or leaving. */
function ConfirmButton({
  label,
  title,
  description,
  confirm,
  onConfirm,
  pending,
}: {
  label: string;
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => void;
  pending: boolean;
}) {
  const t = useTranslations("members");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive" loading={pending}>
          <UserMinusIcon />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Who can access a trip; its owner adds and removes members, a member can leave. */
export function MembersSection({
  tripId,
  tripName,
  owner,
  members,
  userId,
}: {
  tripId: string;
  tripName: string;
  owner: Member;
  members: Member[];
  userId: string;
}) {
  const t = useTranslations("members");
  const tErrors = useTranslations("errors");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const isOwner = owner.id === userId;

  const nameOf = (member: Member) =>
    member.id === userId ? `${member.name} (${t("you")})` : member.name;

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const failure = await addTripMember(tripId, email);
      setError(failure ?? null);
      if (!failure) {
        setEmail("");
        toast.success(t("added", { name: email.trim() }));
      }
    });
  }

  function remove(member: Member) {
    setBusyId(member.id);
    startTransition(async () => {
      const failure = await removeTripMember(tripId, member.id);
      setBusyId(null);
      if (failure) toast.error(tErrors(failure));
      else toast.success(t("removed", { name: member.name }));
    });
  }

  return (
    <section className="grid gap-4" aria-labelledby="members-title">
      <div className="grid gap-1">
        <h2 id="members-title" className="font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <ul className="grid gap-2">
        {[owner, ...members].map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
            data-testid="member"
          >
            <div className="grid min-w-0">
              <span className="flex items-center gap-2 font-medium">
                <span className="truncate">{nameOf(member)}</span>
                {member.id === owner.id && <Badge variant="secondary">{t("owner")}</Badge>}
              </span>
              <span className="truncate text-sm text-muted-foreground">{member.email}</span>
            </div>
            {member.id !== owner.id && isOwner && (
              <ConfirmButton
                label={t("remove", { name: member.name })}
                title={t("removeTitle", { name: member.name })}
                description={t("removeDescription", { name: member.name })}
                confirm={t("confirmRemove")}
                pending={pending && busyId === member.id}
                onConfirm={() => remove(member)}
              />
            )}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <form onSubmit={add} className="grid gap-2" noValidate>
          <Label htmlFor="member-email">{t("email")}</Label>
          <div className="flex gap-2">
            <Input
              id="member-email"
              type="email"
              autoComplete="off"
              value={email}
              placeholder={t("emailPlaceholder")}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "member-email-error" : "member-email-hint"}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" loading={pending && busyId === null}>
              <UserPlusIcon />
              {t("add")}
            </Button>
          </div>
          {error ? (
            <p id="member-email-error" role="alert" className="text-sm text-destructive">
              {tErrors(error)}
            </p>
          ) : (
            <p id="member-email-hint" className="text-xs text-muted-foreground">
              {t("ownerHint")}
            </p>
          )}
        </form>
      ) : (
        <div>
          <ConfirmButton
            label={t("leave")}
            title={t("leaveTitle", { name: tripName })}
            description={t("leaveDescription")}
            confirm={t("confirmLeave")}
            pending={pending}
            onConfirm={() => startTransition(() => leaveTrip(tripId))}
          />
        </div>
      )}
    </section>
  );
}
