import { describe, expect, it } from "vitest";
import { chartColor, colorNumber } from "./category-colors";

describe("category colors", () => {
  it("uses the chosen color, or one following the position", () => {
    expect(colorNumber({ color: 5, position: 0 })).toBe(5);
    expect(colorNumber({ color: null, position: 0 })).toBe(1);
    expect(colorNumber({ color: null, position: 9 })).toBe(2);
  });

  it("maps palette numbers to CSS variables, grey for none", () => {
    expect(chartColor(3)).toBe("var(--chart-3)");
    expect(chartColor(null)).toBe("var(--muted-foreground)");
  });
});
