import { describe, expect, it } from "vitest";
import { groupBy } from "./utils";

describe("groupBy", () => {
  it("groups items by key, in order of first appearance", () => {
    const rows = [
      { date: "2025-03-28", label: "Takoyaki" },
      { date: "2025-03-20", label: "Sushiro" },
      { date: "2025-03-28", label: "Suica" },
    ];
    expect([...groupBy(rows, (row) => row.date)]).toEqual([
      ["2025-03-28", [rows[0], rows[2]]],
      ["2025-03-20", [rows[1]]],
    ]);
    expect(groupBy([], (row) => row).size).toBe(0);
  });
});
