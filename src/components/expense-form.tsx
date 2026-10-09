"use client";

import { useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useState } from "react";
import { saveExpense, type FormState } from "@/app/trips/actions";
import { categoryLabel } from "@/components/category-label";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { convert, formatMoney, parseAmount } from "@/lib/money";

export interface ExpenseFormValues {
  id?: string;
  date: string;
  label: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  categoryId: string | null;
  paymentMethod: string | null;
  notes: string | null;
  participantIds: string[];
}

function parseRate(input: string) {
  const value = Number(input.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function ExpenseForm({
  trip,
  expense,
  categories,
  currencies,
  lastRates,
  paymentMethods,
}: {
  trip: { id: string; baseCurrency: string; participants: { id: string; name: string }[] };
  expense: ExpenseFormValues;
  categories: { id: string; key: string | null; name: string | null }[];
  currencies: { code: string; label: string }[];
  /** Most recent rate used in this trip for each currency, offered as the default. */
  lastRates: Record<string, string>;
  paymentMethods: string[];
}) {
  const t = useTranslations("expenseForm");
  const tAll = useTranslations();
  const tCategories = useTranslations("categories");
  const locale = useLocale();
  const [state, action, pending] = useActionState<FormState, FormData>(saveExpense, {});
  const [amount, setAmount] = useState(expense.amount);
  const [currency, setCurrency] = useState(expense.currency);
  const [rate, setRate] = useState(expense.exchangeRate);
  const fields = state.fields ?? {};
  // Next keeps visited pages in the DOM (hidden): ids derive from what the form edits so that the
  // forms of two pages never share one (useId() does not guarantee that across preserved pages).
  const prefix = expense.id ? `expense-${expense.id}` : `new-expense-${trip.id}`;
  const fieldId = (name: string) => `${prefix}-${name}`;
  const foreign = currency !== trip.baseCurrency;

  const amountMinor = parseAmount(amount, currency);
  const rateValue = parseRate(rate);
  const preview =
    foreign && amountMinor && rateValue
      ? formatMoney(
          convert(amountMinor, currency, rateValue, trip.baseCurrency),
          trip.baseCurrency,
          locale,
        )
      : null;

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
      <input type="hidden" name="tripId" value={trip.id} />
      {expense.id && <input type="hidden" name="expenseId" value={expense.id} />}

      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <Field id={fieldId("amount")} label={t("amount")} error={fields.amount}>
          <Input
            id={fieldId("amount")}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            autoFocus={!expense.id}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={Boolean(fields.amount)}
            className="text-lg"
          />
        </Field>
        <Field id={fieldId("currency")} label={t("currency")}>
          <NativeSelect
            id={fieldId("currency")}
            name="currency"
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
              setRate(lastRates[event.target.value] ?? "");
            }}
            className="w-28"
          >
            {currencies.map((c) => (
              <NativeSelectOption key={c.code} value={c.code} title={c.label}>
                {c.code}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {foreign && (
        <Field id={fieldId("exchangeRate")} label={t("rate")} error={fields.exchangeRate}>
          <div className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted-foreground">
              {t("ratePrefix", { base: trip.baseCurrency })}
            </span>
            <Input
              id={fieldId("exchangeRate")}
              name="exchangeRate"
              inputMode="decimal"
              autoComplete="off"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              aria-invalid={Boolean(fields.exchangeRate)}
            />
            <span className="shrink-0 text-muted-foreground">{currency}</span>
          </div>
          {preview && (
            <p className="text-sm text-muted-foreground" data-testid="converted">
              {t("converted", { amount: preview })}
            </p>
          )}
        </Field>
      )}

      <Field id={fieldId("label")} label={t("label")} error={fields.label}>
        <Input
          id={fieldId("label")}
          name="label"
          defaultValue={expense.label}
          placeholder={t("labelPlaceholder")}
          aria-invalid={Boolean(fields.label)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id={fieldId("date")} label={t("date")} error={fields.date}>
          <Input id={fieldId("date")} name="date" type="date" defaultValue={expense.date} />
        </Field>
        <Field id={fieldId("categoryId")} label={t("category")}>
          <NativeSelect
            id={fieldId("categoryId")}
            name="categoryId"
            defaultValue={expense.categoryId ?? ""}
            wrapperClassName="w-full"
          >
            <NativeSelectOption value="">{t("noCategory")}</NativeSelectOption>
            {categories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {categoryLabel(c, tCategories, "")}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {trip.participants.length > 1 && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t("participants")}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {trip.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Checkbox
                  id={fieldId(`participant-${p.id}`)}
                  name="participantIds"
                  value={p.id}
                  defaultChecked={expense.participantIds.includes(p.id)}
                />
                <Label htmlFor={fieldId(`participant-${p.id}`)} className="font-normal">
                  {p.name}
                </Label>
              </div>
            ))}
          </div>
          {fields.participantIds && (
            <p className="text-sm text-destructive">{tAll(`errors.${fields.participantIds}`)}</p>
          )}
        </fieldset>
      )}
      {trip.participants.length === 1 && (
        <input type="hidden" name="participantIds" value={trip.participants[0].id} />
      )}

      <Field id={fieldId("paymentMethod")} label={t("paymentMethod")}>
        <Input
          id={fieldId("paymentMethod")}
          name="paymentMethod"
          list={fieldId("payment-methods")}
          defaultValue={expense.paymentMethod ?? ""}
          placeholder={t("paymentMethodPlaceholder")}
        />
        <datalist id={fieldId("payment-methods")}>
          {paymentMethods.map((method) => (
            <option key={method} value={method} />
          ))}
        </datalist>
      </Field>

      <Field id={fieldId("notes")} label={t("notes")}>
        <Textarea id={fieldId("notes")} name="notes" defaultValue={expense.notes ?? ""} rows={2} />
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {tAll(`errors.${state.error}`)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {expense.id ? t("save") : t("create")}
      </Button>
    </form>
  );
}
