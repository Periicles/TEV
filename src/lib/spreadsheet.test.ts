import { readFileSync } from "node:fs";
import readExcelFile from "read-excel-file/universal";
import { describe, expect, it } from "vitest";
import {
  convertRows,
  findHeaderRow,
  guessColumns,
  guessParticipantCount,
  localeDateOrder,
  matchCategory,
  parseAmountCell,
  parseDateCell,
  type Cell,
} from "./spreadsheet";

/** Same layout as the spreadsheet the app replaces (`e2e/fixtures/budget.xlsx`). */
async function readFixture(): Promise<Cell[][]> {
  const file = readFileSync("e2e/fixtures/budget.xlsx");
  const [sheet] = await readExcelFile(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer,
  );
  return sheet.data as Cell[][];
}

describe("spreadsheet import", () => {
  it("reads an .xlsx file into expenses, skipping the totals row and side tables", async () => {
    const rows = await readFixture();
    const header = findHeaderRow(rows);
    const mapping = guessColumns(rows, header);
    expect(header).toBe(0);
    // "Column 1" holds categories: found by its values rather than its title.
    expect(mapping).toEqual({ date: 0, label: 1, amount: 2, perPerson: 3, notes: 4, category: 5 });
    expect(guessParticipantCount(rows, header, mapping)).toBe(2);

    const result = convertRows(rows, header, mapping, { currency: "EUR", dateOrder: "dmy" });
    expect(result.rows).toEqual([
      {
        row: 2,
        date: "2025-03-20",
        label: "Sushiro",
        amountMinor: 2383,
        category: "Extras",
        notes: null,
      },
      {
        row: 3,
        date: "2025-03-20",
        label: "Shinkansen Tokyo - Kanazawa",
        amountMinor: 17539,
        category: "Transport",
        notes: null,
      },
      {
        row: 4,
        date: "2025-02-01",
        label: "Airbnb Kyoto",
        amountMinor: 51276,
        category: "Logement",
        notes: "2 nuits",
      },
      // "-" in the date column: no date. The amount is a formula's result.
      { row: 5, date: null, label: "Suica", amountMinor: 7435, category: "Extras", notes: null },
    ]);
    expect(result.skipped).toEqual([{ row: 6, reason: "noLabel", cells: ["786.33", "393.165"] }]);
  });

  it("matches column titles in French and English, exactly or as a word", () => {
    const rows: Cell[][] = [
      ["Libellé", "Montant (€)", "Catégorie", "Jour", "Commentaire"],
      ["Sushiro", 23.83, "Restauration", "20/03/2025", null],
    ];
    expect(guessColumns(rows, 0)).toEqual({ label: 0, amount: 1, category: 2, date: 3, notes: 4 });
  });

  it("finds the header below a title row", () => {
    const rows: Cell[][] = [["Japon 2025"], [], ["Date", "Expense", "Amount"], ["", "Bus", 3]];
    expect(findHeaderRow(rows)).toBe(2);
  });

  it("reads dates as dates, Excel serial numbers or text in the locale's order", () => {
    expect(parseDateCell(new Date("2025-03-20T00:00:00Z"), "dmy")).toBe("2025-03-20");
    expect(parseDateCell(45736, "dmy")).toBe("2025-03-20");
    expect(parseDateCell("2025-03-20", "mdy")).toBe("2025-03-20");
    expect(parseDateCell("20/03/2025", "dmy")).toBe("2025-03-20");
    expect(parseDateCell("3/20/25", "mdy")).toBe("2025-03-20");
    expect(parseDateCell("31/02/2025", "dmy")).toBeNull();
    expect(parseDateCell("-", "dmy")).toBeNull();
    expect(parseDateCell(3.5, "dmy")).toBeNull();
    expect(parseDateCell(null, "dmy")).toBeNull();
  });

  it("reads amounts as numbers or text, in the currency's minor units", () => {
    expect(parseAmountCell(306.03, "EUR")).toBe(30603);
    expect(parseAmountCell(3850, "JPY")).toBe(3850);
    expect(parseAmountCell("1 234,50 €", "EUR")).toBe(123450);
    expect(parseAmountCell("$12.00", "USD")).toBe(1200);
    expect(parseAmountCell("abc", "EUR")).toBeNull();
    expect(parseAmountCell(true, "EUR")).toBeNull();
  });

  it("skips rows without a label or a positive amount", () => {
    const rows: Cell[][] = [
      ["Date", "Expense", "Total cost"],
      [45736, "Remboursement", -20],
      [45736, "Gratuit", "?"],
      [45736, "Musée", null],
      [null, null, null],
    ];
    const result = convertRows(rows, 0, guessColumns(rows, 0), {
      currency: "EUR",
      dateOrder: "dmy",
    });
    expect(result.rows).toEqual([]);
    expect(result.skipped.map((s) => [s.row, s.reason])).toEqual([
      [2, "invalidAmount"],
      [3, "invalidAmount"],
      [4, "noAmount"],
    ]);
  });

  it("does not guess a participant count without a consistent per-person column", () => {
    const rows: Cell[][] = [
      ["Expense", "Total cost", "Cost per person"],
      ["Bus", 10, 3.3],
    ];
    expect(guessParticipantCount(rows, 0, guessColumns(rows, 0))).toBeNull();
    expect(guessParticipantCount(rows, 0, { label: 0, amount: 1 })).toBeNull();
  });

  it("matches spreadsheet categories with existing ones by name or meaning", () => {
    const categories = [
      { id: "1", key: "transport", name: null },
      { id: "2", key: "lodging", name: null },
      { id: "3", key: null, name: "Extras" },
    ];
    expect(matchCategory("Transport", categories)?.id).toBe("1");
    expect(matchCategory("Hébergement", categories)?.id).toBe("2");
    expect(matchCategory("extras", categories)?.id).toBe("3");
    expect(matchCategory("Souvenirs", categories)).toBeUndefined();
  });

  it("knows the order of day and month for a locale", () => {
    expect(localeDateOrder("fr-FR")).toBe("dmy");
    expect(localeDateOrder("en-GB")).toBe("dmy");
    expect(localeDateOrder("en-US")).toBe("mdy");
    expect(localeDateOrder("ja-JP")).toBe("ymd");
  });
});
