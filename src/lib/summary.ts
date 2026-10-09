export interface SummaryExpense {
  id: string;
  date: string;
  baseAmountMinor: number;
  categoryId: string | null;
  participantIds: string[];
  /** Participant who paid, or `null` when unknown. */
  paidBy: string | null;
}

export interface TripSummary {
  totalMinor: number;
  /** Share of the total owed by each participant, in the trip's base currency. */
  byParticipant: Map<string, number>;
  byCategory: Map<string | null, number>;
  /**
   * What each participant paid minus their share, over the expenses whose payer is known: positive
   * when they are owed money. Always sums to zero.
   */
  balances: Map<string, number>;
  /** Expenses left out of the balances because nobody is recorded as having paid them. */
  unpaidCount: number;
}

export interface Settlement {
  from: string;
  to: string;
  amountMinor: number;
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
  const balances = new Map(participants.map((p) => [p.id, 0]));
  let totalMinor = 0;
  let unpaidCount = 0;

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
    const payer = expense.paidBy && balances.has(expense.paidBy) ? expense.paidBy : null;
    if (payer) balances.set(payer, balances.get(payer)! + expense.baseAmountMinor);
    else unpaidCount++;
    for (const p of sharing) {
      const extra = luckiest.includes(p) ? 1 : 0;
      byParticipant.set(p.id, byParticipant.get(p.id)! + base + extra);
      extraCents.set(p.id, extraCents.get(p.id)! + extra);
      if (payer) balances.set(p.id, balances.get(p.id)! - base - extra);
    }
  }

  return { totalMinor, byParticipant, byCategory, balances, unpaidCount };
}

/**
 * Who should pay whom to even out the balances, in few transfers: the largest debt is repaid to
 * the largest creditor first, until everyone is even. Ties keep the participants' order.
 */
export function settleUp(balances: Map<string, number>): Settlement[] {
  const debtors = [...balances].filter(([, b]) => b < 0).map(([id, b]) => ({ id, left: -b }));
  const creditors = [...balances].filter(([, b]) => b > 0).map(([id, b]) => ({ id, left: b }));
  const settlements: Settlement[] = [];
  for (;;) {
    const debtor = debtors.toSorted((a, b) => b.left - a.left).find((d) => d.left > 0);
    const creditor = creditors.toSorted((a, b) => b.left - a.left).find((c) => c.left > 0);
    if (!debtor || !creditor) return settlements;
    const amountMinor = Math.min(debtor.left, creditor.left);
    settlements.push({ from: debtor.id, to: creditor.id, amountMinor });
    debtor.left -= amountMinor;
    creditor.left -= amountMinor;
  }
}
