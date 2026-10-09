import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getExpense, getTripDetails, listCategories, NotFoundError } from "./trips";

/** Runs a lookup for a page, turning a missing (or someone else's) record into a 404. */
async function orNotFound<T>(lookup: () => Promise<T>): Promise<T> {
  try {
    return await lookup();
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function loadTripPage(tripId: string) {
  const { user } = await requireSession();
  const [trip, categories] = await Promise.all([
    orNotFound(() => getTripDetails(user.id, tripId)),
    listCategories(user.id),
  ]);
  return { trip, categories };
}

export async function loadExpensePage(tripId: string, expenseId: string) {
  const { user } = await requireSession();
  const page = await loadTripPage(tripId);
  const expense = await orNotFound(() => getExpense(user.id, expenseId));
  if (expense.tripId !== page.trip.id) notFound();
  return { ...page, expense };
}

/** Today's date (YYYY-MM-DD) in the given time zone. */
export function today(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}
