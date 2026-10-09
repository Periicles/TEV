"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { saveExpense, suggestRate, type FormState } from "@/app/trips/actions";
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
  rateSource: "same" | "manual" | "official";
  categoryId: string | null;
  paymentMethod: string | null;
  notes: string | null;
  participantIds: string[];
  paidBy: string | null;
}

type Suggestion = { key: string; value: { rate: number; date: string } | null };

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
  trip: {
    id: string;
    baseCurrency: string;
    trackPayers: boolean;
    participants: { id: string; name: string }[];
  };
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
  const format = useFormatter();
  const [state, action, pending] = useActionState<FormState, FormData>(saveExpense, {});
  const [amount, setAmount] = useState(expense.amount);
  const [currency, setCurrency] = useState(expense.currency);
  const [date, setDate] = useState(expense.date);
  const [rate, setRate] = useState(expense.exchangeRate);
  const [rateSource, setRateSource] = useState(
    expense.rateSource === "official" ? "official" : "manual",
  );
  // A rate typed by hand is never replaced by a suggestion.
  const rateTyped = useRef(expense.rateSource === "manual");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const fields = state.fields ?? {};
  // Next keeps visited pages in the DOM (hidden): ids derive from what the form edits so that the
  // forms of two pages never share one (useId() does not guarantee that across preserved pages).
  const prefix = expense.id ? `expense-${expense.id}` : `new-expense-${trip.id}`;
  const fieldId = (name: string) => `${prefix}-${name}`;
  const foreign = currency !== trip.baseCurrency;
  const suggestionKey = `${currency}|${date}`;
  const current = suggestion?.key === suggestionKey ? suggestion.value : undefined;
  const rateInput = (value: number) =>
    new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 10 }).format(value);

  // Looks the official rate up for the chosen currency and date.
  useEffect(() => {
    if (!foreign || !date) return;
    let stale = false;
    suggestRate(trip.baseCurrency, currency, date).then(
      (value) => {
        if (stale) return;
        setSuggestion({ key: `${currency}|${date}`, value });
        if (value && !rateTyped.current) {
          setRate(rateInput(value.rate));
          setRateSource("official");
        }
      },
      () => !stale && setSuggestion({ key: `${currency}|${date}`, value: null }),
    );
    return () => {
      stale = true;
    };
    // rateInput only depends on the locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foreign, currency, date, trip.baseCurrency]);

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
              // A new currency starts from its last rate until the official one arrives.
              setCurrency(event.target.value);
              setRate(lastRates[event.target.value] ?? "");
              setRateSource("manual");
              rateTyped.current = false;
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
              onChange={(event) => {
                setRate(event.target.value);
                setRateSource("manual");
                rateTyped.current = true;
              }}
              aria-invalid={Boolean(fields.exchangeRate)}
            />
            <span className="shrink-0 text-muted-foreground">{currency}</span>
          </div>
          <input type="hidden" name="rateSource" value={rateSource} />
          <p className="text-xs text-muted-foreground" data-testid="rate-status">
            {current === undefined
              ? t("rateLoading")
              : rateSource === "official" && current
                ? t("rateOfficial", {
                    date: format.dateTime(new Date(`${current.date}T00:00:00Z`), {
                      timeZone: "UTC",
                      dateStyle: "long",
                    }),
                  })
                : current
                  ? t("rateManual")
                  : t("rateUnavailable")}
            {current && rateSource === "manual" && (
              <>
                {" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    setRate(rateInput(current.rate));
                    setRateSource("official");
                    rateTyped.current = false;
                  }}
                >
                  {t("useOfficialRate", { rate: rateInput(current.rate) })}
                </Button>
              </>
            )}
          </p>
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
          <Input
            id={fieldId("date")}
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
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

      {trip.trackPayers && trip.participants.length > 1 ? (
        <Field id={fieldId("paidBy")} label={t("paidBy")}>
          <NativeSelect
            id={fieldId("paidBy")}
            name="paidBy"
            defaultValue={expense.paidBy ?? ""}
            wrapperClassName="w-full"
          >
            {trip.participants.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value="">{t("paidByUnknown")}</NativeSelectOption>
          </NativeSelect>
        </Field>
      ) : (
        // Not asked: a lone participant paid; otherwise the payer (if any) is kept as it was, so
        // turning tracking off and on again loses nothing.
        <input
          type="hidden"
          name="paidBy"
          value={trip.trackPayers ? trip.participants[0].id : (expense.paidBy ?? "")}
        />
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
