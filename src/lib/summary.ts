export interface SummaryExpense {
  id: string;
  date: string;
  baseAmountMinor: number;
  categoryId: string | null;
  participantIds: string[];
}

export interface TripSummary {
  totalMinor: number;
  /** Share of the total owed by each participant, in the trip's base currency. */
  byParticipant: Map<string, number>;
  byCategory: Map<string | null, number>;
}

/**
 * Totals a trip in its base currency. Each expense is split evenly between its participants; the
 * rounding remainder (a cent here and there) goes to whoever has received the fewest extra cents so
 * far, so over a whole trip no participant pays more than a cent of rounding more than another.
 * Expenses are taken in date order (then by id) so the result does not depend on how they are listed.
 */
export function summarizeTrip(
  participants: { id: string }[],
  expenses: SummaryExpense[],
): TripSummary {
  const byParticipant = new Map(participants.map((p) => [p.id, 0]));
  const extraCents = new Map(participants.map((p) => [p.id, 0]));
  const byCategory = new Map<string | null, number>();
  let totalMinor = 0;

  const ordered = expenses.toSorted(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  for (const expense of ordered) {
    totalMinor += expense.baseAmountMinor;
    byCategory.set(
      expense.categoryId,
      (byCategory.get(expense.categoryId) ?? 0) + expense.baseAmountMinor,
    );
    const sharing = participants.filter((p) => expense.participantIds.includes(p.id));
    if (sharing.length === 0) continue;

    const base = Math.floor(expense.baseAmountMinor / sharing.length);
    const remainder = expense.baseAmountMinor - base * sharing.length;
    // Fewest extra cents first; ties keep the trip's order (sort is stable).
    const luckiest = sharing
      .toSorted((a, b) => extraCents.get(a.id)! - extraCents.get(b.id)!)
      .slice(0, remainder);
    for (const p of sharing) {
      const extra = luckiest.includes(p) ? 1 : 0;
      byParticipant.set(p.id, byParticipant.get(p.id)! + base + extra);
      extraCents.set(p.id, extraCents.get(p.id)! + extra);
    }
  }

  return { totalMinor, byParticipant, byCategory };
}
