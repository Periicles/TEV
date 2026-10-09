import { splitEvenly } from "./money";

export interface SummaryExpense {
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
 * Totals a trip in its base currency. Each expense is split evenly between its participants, the
 * rounding remainder going to the first ones in the trip's order.
 */
export function summarizeTrip(
  participants: { id: string }[],
  expenses: SummaryExpense[],
): TripSummary {
  const byParticipant = new Map(participants.map((p) => [p.id, 0]));
  const byCategory = new Map<string | null, number>();
  let totalMinor = 0;

  for (const expense of expenses) {
    totalMinor += expense.baseAmountMinor;
    byCategory.set(
      expense.categoryId,
      (byCategory.get(expense.categoryId) ?? 0) + expense.baseAmountMinor,
    );
    const sharing = participants.filter((p) => expense.participantIds.includes(p.id));
    const shares = splitEvenly(expense.baseAmountMinor, Math.max(sharing.length, 1));
    sharing.forEach((p, index) =>
      byParticipant.set(p.id, byParticipant.get(p.id)! + shares[index]),
    );
  }

  return { totalMinor, byParticipant, byCategory };
}
