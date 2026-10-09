"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { flash } from "@/app/flash";
import type { ErrorCode } from "@/i18n/errors";
import { isCurrency, parseAmount } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { officialRate, type OfficialRate } from "@/server/exchange-rates";
import { importTrip, type ImportInput } from "@/server/import";
import {
  createExpense,
  createTrip,
  deleteExpense,
  deleteTrip,
  getTrip,
  InputError,
  NotFoundError,
  restoreExpense,
  restoreTrip,
  updateExpense,
  updateTrip,
} from "@/server/trips";

/** Translation keys under `errors`, for the whole form and per field. */
export interface FormState {
  error?: ErrorCode;
  fields?: Record<string, ErrorCode>;
}

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optional(form: FormData, name: string) {
  return text(form, name) || null;
}

/** Parses a rate typed with either `.` or `,` as decimal separator. */
function parseRate(input: string): number | null {
  const value = Number(input.replace(/[\s  ]/g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function failure(error: unknown): FormState {
  if (error instanceof InputError) return { error: error.code };
  if (error instanceof z.ZodError) {
    const fields: Record<string, ErrorCode> = {};
    for (const issue of error.issues) {
      const field = String(issue.path[0] ?? "form");
      fields[field] ??= issue.message === "endBeforeStart" ? "endBeforeStart" : "required";
    }
    return { fields };
  }
  if (error instanceof NotFoundError) return { error: "notFound" };
  console.error(error);
  return { error: "unexpected" };
}

export async function saveTrip(_state: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const tripId = optional(form, "tripId");
  const ids = form.getAll("participantId").map(String);
  const names = form.getAll("participantName").map((name) => String(name).trim());
  const baseCurrency = text(form, "baseCurrency");
  const budgetText = text(form, "budget");
  const budgetMinor = budgetText ? parseAmount(budgetText, baseCurrency) : null;
  if (budgetText && budgetMinor === null) return { fields: { budget: "invalidAmount" } };
  const input = {
    name: text(form, "name"),
    baseCurrency,
    startDate: optional(form, "startDate"),
    endDate: optional(form, "endDate"),
    trackPayers: form.get("trackPayers") === "on",
    budgetMinor,
    showDailyTotals: form.get("showDailyTotals") === "on",
    participants: names
      .map((name, index) => ({ id: ids[index] || undefined, name }))
      .filter((p) => p.name || p.id),
  };

  let savedId: string;
  try {
    savedId = tripId
      ? (await updateTrip(user.id, tripId, input)).id
      : (await createTrip(user.id, input)).id;
  } catch (error) {
    return failure(error);
  }
  await flash({ kind: tripId ? "tripSaved" : "tripCreated" });
  redirect(`/trips/${savedId}`);
}

export async function removeTrip(tripId: string) {
  const { user } = await requireSession();
  await deleteTrip(user.id, tripId);
  await flash({ kind: "tripDeleted", id: tripId });
  redirect("/");
}

/** Brings a deleted trip back; returns its id, or `null` when it is gone for good. */
export async function undoRemoveTrip(tripId: string): Promise<string | null> {
  const { user } = await requireSession();
  const restored = await restoreTrip(user.id, tripId).catch(() => null);
  revalidatePath("/", "layout");
  return restored;
}

export async function saveExpense(_state: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const tripId = text(form, "tripId");
  const expenseId = optional(form, "expenseId");
  const currency = text(form, "currency");

  const fields: Record<string, ErrorCode> = {};
  const amountMinor = parseAmount(text(form, "amount"), currency);
  if (amountMinor === null) fields.amount = "invalidAmount";
  const rateText = text(form, "exchangeRate");
  const exchangeRate = rateText ? parseRate(rateText) : null;
  if (rateText && exchangeRate === null) fields.exchangeRate = "invalidRate";
  const participantIds = form.getAll("participantIds").map(String);
  if (participantIds.length === 0) fields.participantIds = "noParticipant";
  if (Object.keys(fields).length > 0) return { fields };

  const date = text(form, "date");
  // The official rate is looked up here rather than trusted from the browser.
  let rate = { exchangeRate, rateSource: "manual" as "manual" | "official" };
  if (text(form, "rateSource") === "official") {
    const trip = await getTrip(user.id, tripId).catch(() => null);
    const official = trip && (await officialRate(trip.baseCurrency, currency, date));
    if (official) rate = { exchangeRate: official.rate, rateSource: "official" };
  }

  const input = {
    date,
    label: text(form, "label"),
    amountMinor: amountMinor!,
    currency,
    ...rate,
    categoryId: optional(form, "categoryId"),
    paymentMethod: optional(form, "paymentMethod"),
    notes: optional(form, "notes"),
    participantIds,
    paidBy: optional(form, "paidBy"),
  };

  try {
    if (expenseId) await updateExpense(user.id, expenseId, input);
    else await createExpense(user.id, tripId, input);
  } catch (error) {
    if (error instanceof InputError && error.code === "rateRequired") {
      return { fields: { exchangeRate: "rateRequired" } };
    }
    return failure(error);
  }
  await flash({ kind: expenseId ? "expenseSaved" : "expenseAdded" });
  redirect(`/trips/${tripId}`);
}

export async function removeExpense(expenseId: string) {
  const { user } = await requireSession();
  const tripId = await deleteExpense(user.id, expenseId);
  await flash({ kind: "expenseDeleted", id: expenseId });
  redirect(`/trips/${tripId}`);
}

/** Brings a deleted expense back; returns its trip's id, or `null` when it is gone for good. */
export async function undoRemoveExpense(expenseId: string): Promise<string | null> {
  const { user } = await requireSession();
  const tripId = await restoreExpense(user.id, expenseId).catch(() => null);
  revalidatePath("/", "layout");
  return tripId;
}

/** The official rate suggested for an expense, or `null` when there is none. */
export async function suggestRate(
  base: string,
  quote: string,
  date: string,
): Promise<OfficialRate | null> {
  await requireSession();
  if (!isCurrency(base) || !isCurrency(quote)) return null;
  return officialRate(base, quote, date);
}

/** Creates a trip from a spreadsheet converted and checked in the browser. */
export async function importSpreadsheet(input: ImportInput): Promise<FormState> {
  const { user } = await requireSession();
  let tripId: string;
  try {
    tripId = (await importTrip(user.id, input)).id;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn("Invalid spreadsheet import:", z.prettifyError(error));
      return { error: "importInvalid" };
    }
    return failure(error);
  }
  await flash({ kind: "tripImported", count: input.expenses.length });
  redirect(`/trips/${tripId}`);
}
