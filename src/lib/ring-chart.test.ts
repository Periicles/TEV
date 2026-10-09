import { describe, expect, it } from "vitest";
import { ringArcs } from "./ring-chart";

// Circumference 100 to read the numbers easily.
const ring = { radius: 50 / Math.PI, strokeWidth: 2, gap: 4 };

describe("ringArcs", () => {
  it("gives each value its share of the ring, minus the gap and the round caps", () => {
    expect(ringArcs([3, 1], ring)).toEqual([
      { dashArray: "69 100", dashOffset: -3, full: false },
      { dashArray: "19 100", dashOffset: -78, full: false },
    ]);
  });

  it("draws a single value as the whole ring", () => {
    expect(ringArcs([0, 42], ring)).toEqual([
      { dashArray: "0 100", dashOffset: -3, full: false },
      { dashArray: "100 0", dashOffset: 0, full: true },
    ]);
  });

  it("keeps a tiny share visible as a dot", () => {
    const [, tiny] = ringArcs([1000, 1], ring);
    expect(tiny.dashArray).toBe("0.001 100");
  });

  it("draws nothing without positive values", () => {
    expect(ringArcs([0, -2], ring).map((arc) => arc.dashArray)).toEqual(["0 100", "0 100"]);
  });
});
