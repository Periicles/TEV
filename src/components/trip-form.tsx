"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useId, useState } from "react";
import { saveTrip, type FormState } from "@/app/trips/actions";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface TripFormValues {
  id?: string;
  name: string;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  participants: { id?: string; name: string }[];
}

export function TripForm({
  trip,
  currencies,
}: {
  trip: TripFormValues;
  currencies: { code: string; label: string }[];
}) {
  const t = useTranslations("tripForm");
  const tErrors = useTranslations("errors");
  const [state, action, pending] = useActionState<FormState, FormData>(saveTrip, {});
  const keyPrefix = useId();
  // Next keeps visited pages in the DOM (hidden): ids derive from what the form edits so that the
  // forms of two pages never share one (useId() does not guarantee that across preserved pages).
  const fieldId = (name: string) => `${trip.id ? `trip-${trip.id}` : "new-trip"}-${name}`;
  const [participants, setParticipants] = useState(() =>
    trip.participants.map((p, index) => ({ ...p, key: `${keyPrefix}-${index}` })),
  );
  const fields = state.fields ?? {};

  return (
    <form
      // Submitting through a transition instead of `action` keeps the fields when validation fails.
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(() => action(form));
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      {trip.id && <input type="hidden" name="tripId" value={trip.id} />}

      <Field id={fieldId("name")} label={t("name")} error={fields.name}>
        <Input
          id={fieldId("name")}
          name="name"
          defaultValue={trip.name}
          placeholder={t("namePlaceholder")}
          required
          aria-invalid={Boolean(fields.name)}
        />
      </Field>

      <Field id={fieldId("baseCurrency")} label={t("baseCurrency")} hint={t("baseCurrencyHint")}>
        <NativeSelect
          id={fieldId("baseCurrency")}
          name="baseCurrency"
          defaultValue={trip.baseCurrency}
          wrapperClassName="w-full"
        >
          {currencies.map((c) => (
            <NativeSelectOption key={c.code} value={c.code}>
              {c.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id={fieldId("startDate")} label={t("startDate")} error={fields.startDate}>
          <Input
            id={fieldId("startDate")}
            name="startDate"
            type="date"
            defaultValue={trip.startDate ?? ""}
          />
        </Field>
        <Field id={fieldId("endDate")} label={t("endDate")} error={fields.endDate}>
          <Input
            id={fieldId("endDate")}
            name="endDate"
            type="date"
            defaultValue={trip.endDate ?? ""}
            aria-invalid={Boolean(fields.endDate)}
          />
        </Field>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t("participants")}</legend>
        <p className="-mt-1 text-xs text-muted-foreground">{t("participantsHint")}</p>
        {participants.map((p, index) => (
          <div key={p.key} className="flex gap-2">
            <input type="hidden" name="participantId" value={p.id ?? ""} />
            <Input
              name="participantName"
              defaultValue={p.name}
              aria-label={t("participantName", { number: index + 1 })}
              required={index === 0}
            />
            {participants.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("removeParticipant", { name: p.name || index + 1 })}
                onClick={() => setParticipants((list) => list.filter((item) => item.key !== p.key))}
              >
                <XIcon />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() =>
            setParticipants((list) => [...list, { name: "", key: `${keyPrefix}-${Date.now()}` }])
          }
        >
          <PlusIcon />
          {t("addParticipant")}
        </Button>
        {fields.participants && (
          <p className="text-sm text-destructive">{tErrors(fields.participants)}</p>
        )}
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(state.error)}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {trip.id ? t("save") : t("create")}
      </Button>
    </form>
  );
}
