import { describe, expect, it } from "vitest";
import { summarizeTrip, type SummaryExpense } from "./summary";

const people = [{ id: "a" }, { id: "b" }, { id: "c" }];

function expenses(...items: Omit<SummaryExpense, "id" | "date">[]): SummaryExpense[] {
  return items.map((item, index) => ({
    id: `e${String(index).padStart(3, "0")}`,
    date: "2025-03-20",
    ...item,
  }));
}

describe("summarizeTrip", () => {
  it("totals the trip, by participant and by category", () => {
    const summary = summarizeTrip(
      people,
      expenses(
        { baseAmountMinor: 300, categoryId: "food", participantIds: ["a", "b", "c"] },
        { baseAmountMinor: 1000, categoryId: "lodging", participantIds: ["a", "b"] },
        { baseAmountMinor: 50, categoryId: null, participantIds: ["c"] },
        { baseAmountMinor: 100, categoryId: "food", participantIds: ["a", "b", "c"] },
      ),
    );

    expect(summary.totalMinor).toBe(1450);
    expect(Object.fromEntries(summary.byParticipant)).toEqual({ a: 634, b: 633, c: 183 });
    expect(Object.fromEntries(summary.byCategory)).toEqual({ food: 400, lodging: 1000, null: 50 });
  });

  it("hands rounding cents out in turn instead of always to the first participant", () => {
    // 18 expenses with an odd number of cents, split in two: 9 extra cents each.
    const odd = Array.from({ length: 18 }, () => ({
      baseAmountMinor: 2383,
      categoryId: null,
      participantIds: ["a", "b"],
    }));
    const summary = summarizeTrip(people.slice(0, 2), expenses(...odd));

    expect(Object.fromEntries(summary.byParticipant)).toEqual({ a: 21447, b: 21447 });
  });

  it("keeps any two participants within a cent of each other on shared expenses", () => {
    const amounts = [1, 2, 4, 5, 7, 10, 11, 13, 101, 997];
    const summary = summarizeTrip(
      people,
      expenses(
        ...amounts.map((baseAmountMinor) => ({
          baseAmountMinor,
          categoryId: null,
          participantIds: ["a", "b", "c"],
        })),
      ),
    );
    const shares = [...summary.byParticipant.values()];

    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(summary.totalMinor);
  });

  it("does not depend on the order expenses are listed in", () => {
    const items = expenses(
      { baseAmountMinor: 101, categoryId: null, participantIds: ["a", "b"] },
      { baseAmountMinor: 7, categoryId: null, participantIds: ["a", "b", "c"] },
      { baseAmountMinor: 55, categoryId: null, participantIds: ["b", "c"] },
    ).map((e, index) => ({ ...e, date: `2025-03-2${index}` }));

    expect(summarizeTrip(people, items.toReversed()).byParticipant).toEqual(
      summarizeTrip(people, items).byParticipant,
    );
  });

  it("always adds the participants' shares up to the total", () => {
    const summary = summarizeTrip(
      people,
      expenses(
        { baseAmountMinor: 2383, categoryId: null, participantIds: ["a", "b", "c"] },
        { baseAmountMinor: 1, categoryId: null, participantIds: ["b", "c"] },
      ),
    );
    const shares = [...summary.byParticipant.values()].reduce((sum, share) => sum + share, 0);

    expect(shares).toBe(summary.totalMinor);
  });

  it("starts every participant at zero", () => {
    expect(Object.fromEntries(summarizeTrip(people, []).byParticipant)).toEqual({
      a: 0,
      b: 0,
      c: 0,
    });
  });
});
