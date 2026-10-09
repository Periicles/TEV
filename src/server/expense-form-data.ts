import { getLocale, getTimeZone, getTranslations } from "next-intl/server";
import { currencyOptions } from "@/lib/currencies";
import { toMajor } from "@/lib/money";
import { today } from "./pages";
import type { getTripDetails } from "./trips";

type Trip = Awaited<ReturnType<typeof getTripDetails>>;

/** Defaults and choices the expense form derives from the trip's previous expenses. */
export async function expenseFormData(trip: Trip) {
  const [locale, timeZone, t] = await Promise.all([
    getLocale(),
    getTimeZone(),
    getTranslations("paymentMethods"),
  ]);

  // Defaults follow what was entered last, whatever the expenses' own dates.
  const byEntry = trip.expenses.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const lastRates: Record<string, string> = {};
  for (const e of byEntry) {
    if (e.currency !== trip.baseCurrency && !(e.currency in lastRates)) {
      lastRates[e.currency] = decimalInput(Number(e.exchangeRate), locale);
    }
  }
  const usedCurrencies = [trip.baseCurrency, ...trip.expenses.map((e) => e.currency)];
  const paymentMethods = [
    ...new Set([
      t("card"),
      t("cash"),
      ...trip.expenses.flatMap((e) => (e.paymentMethod ? [e.paymentMethod] : [])),
    ]),
  ];

  return {
    currencies: currencyOptions(locale, usedCurrencies),
    lastRates,
    paymentMethods,
    today: today(timeZone),
    lastCurrency: byEntry[0]?.currency ?? trip.baseCurrency,
    // Whoever paid last pays again by default; the first participant (usually you) otherwise.
    lastPayer: byEntry.find((e) => e.paidBy)?.paidBy ?? trip.participants[0]?.id ?? null,
    locale,
  };
}

/** A number as typed in an input, in the user's notation (`161,56` in French). */
export function decimalInput(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 10 }).format(
    value,
  );
}

/** The value of an amount input for an existing expense. */
export function amountInput(amountMinor: number, currency: string, locale: string) {
  return decimalInput(toMajor(amountMinor, currency), locale);
}
