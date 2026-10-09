import { describe, expect, it } from "vitest";
import { summarizeTrip } from "./summary";

const people = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("summarizeTrip", () => {
  it("totals the trip, by participant and by category", () => {
    const summary = summarizeTrip(people, [
      { baseAmountMinor: 300, categoryId: "food", participantIds: ["a", "b", "c"] },
      { baseAmountMinor: 1000, categoryId: "lodging", participantIds: ["a", "b"] },
      { baseAmountMinor: 50, categoryId: null, participantIds: ["c"] },
      { baseAmountMinor: 100, categoryId: "food", participantIds: ["a", "b", "c"] },
    ]);

    expect(summary.totalMinor).toBe(1450);
    expect(Object.fromEntries(summary.byParticipant)).toEqual({ a: 634, b: 633, c: 183 });
    expect(Object.fromEntries(summary.byCategory)).toEqual({ food: 400, lodging: 1000, null: 50 });
  });

  it("always adds the participants' shares up to the total", () => {
    const summary = summarizeTrip(people, [
      { baseAmountMinor: 2383, categoryId: null, participantIds: ["a", "b", "c"] },
      { baseAmountMinor: 1, categoryId: null, participantIds: ["b", "c"] },
    ]);
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
