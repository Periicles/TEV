import { describe, expect, it } from "vitest";
import { matchesSearch, searchText } from "./expense-search";

const sushi = searchText(["Sushiro", "Restauration", "Carte", "23,83 €", "3 850 JPY", null, false]);

describe("expense search", () => {
  it("finds words in any order, without case or accents", () => {
    expect(matchesSearch(sushi, "sushi")).toBe(true);
    expect(matchesSearch(sushi, "carte RESTAU")).toBe(true);
    expect(matchesSearch(sushi, "réstauration")).toBe(true);
    expect(matchesSearch(sushi, "espèces")).toBe(false);
  });

  it("finds amounts typed with a comma or a dot", () => {
    expect(matchesSearch(sushi, "23,83")).toBe(true);
    expect(matchesSearch(sushi, "23.83")).toBe(true);
    expect(matchesSearch(sushi, "jpy")).toBe(true);
  });

  it("matches the start of words, not their middle", () => {
    expect(matchesSearch(sushi, "hiro")).toBe(false);
  });

  it("matches everything with an empty query", () => {
    expect(matchesSearch(sushi, "  ")).toBe(true);
  });
});
