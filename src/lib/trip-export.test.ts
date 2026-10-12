import readExcelFile from "read-excel-file/universal";
import { describe, expect, it } from "vitest";
import writeExcelFile from "write-excel-file/node";
import { convertRows, findHeaderRow, guessColumns, type Cell } from "./spreadsheet";
import {
  amountFormat,
  columnWidths,
  exportFileName,
  tripSheet,
  type ExportOptions,
  type ExportTrip,
} from "./trip-export";

const participants = [
  { id: "p1", name: "Paul" },
  { id: "p2", name: "Léa" },
];

const expense = {
  createdAt: new Date("2025-03-20T10:00:00Z"),
  categoryId: "food",
  currency: "EUR",
  exchangeRate: "1",
  paidBy: null,
  paymentMethod: null,
  participantIds: ["p2", "p1"],
  notes: null,
};

const trip: ExportTrip = {
  baseCurrency: "EUR",
  trackPayers: false,
  participants,
  // As the trip page loads them: newest first.
  expenses: [
    {
      ...expense,
      date: "2025-03-28",
      label: "Takoyaki",
      amountMinor: 1200,
      baseAmountMinor: 1200,
      paymentMethod: "Espèces",
      participantIds: ["p1"],
      notes: "Dotonbori",
    },
    {
      ...expense,
      date: "2025-03-20",
      createdAt: new Date("2025-03-20T12:00:00Z"),
      label: "Shinkansen",
      categoryId: "transport",
      amountMinor: 28339,
      currency: "JPY",
      exchangeRate: "161.56",
      baseAmountMinor: 17541,
      paidBy: "p2",
    },
    { ...expense, date: "2025-03-20", label: "Sushiro", amountMinor: 2383, baseAmountMinor: 2383 },
  ],
};

const options: ExportOptions = {
  labels: {
    date: "Date",
    label: "Libellé",
    amount: "Montant (EUR)",
    category: "Catégorie",
    paymentMethod: "Moyen de paiement",
    paidBy: "Payé par",
    participants: "Partagé entre",
    originalAmount: "Montant d'origine",
    currency: "Devise",
    rate: "Taux (1 EUR =)",
    notes: "Notes",
  },
  categoryName: (id) => ({ food: "Restauration", transport: "Transport" })[id ?? ""] ?? "Aucune",
  dateFormat: "dd/mm/yyyy",
};

/** The cells' values, without their formatting. */
const values = (rows: ReturnType<typeof tripSheet>) =>
  rows.map((row) =>
    row.map((cell) => (cell && typeof cell === "object" && "value" in cell ? cell.value : cell)),
  );

describe("trip export", () => {
  it("lists expenses oldest first, with foreign-currency columns only where they apply", () => {
    expect(values(tripSheet(trip, options))).toEqual([
      [
        "Date",
        "Libellé",
        "Montant (EUR)",
        "Catégorie",
        "Moyen de paiement",
        "Partagé entre",
        "Montant d'origine",
        "Devise",
        "Taux (1 EUR =)",
        "Notes",
      ],
      [
        new Date("2025-03-20T00:00:00Z"),
        "Sushiro",
        23.83,
        "Restauration",
        null,
        "Paul, Léa",
        null,
        null,
        null,
        null,
      ],
      [
        new Date("2025-03-20T00:00:00Z"),
        "Shinkansen",
        175.41,
        "Transport",
        null,
        "Paul, Léa",
        28339,
        "JPY",
        161.56,
        null,
      ],
      [
        new Date("2025-03-28T00:00:00Z"),
        "Takoyaki",
        12,
        "Restauration",
        "Espèces",
        "Paul",
        null,
        null,
        null,
        "Dotonbori",
      ],
    ]);
  });

  it("adds a payer column when the trip tracks who paid", () => {
    const rows = values(tripSheet({ ...trip, trackPayers: true }, options));
    expect(rows.map((row) => row[5])).toEqual(["Payé par", null, "Léa", null]);
    expect(rows[0]).toHaveLength(columnWidths({ trackPayers: true }).length);
    expect(values(tripSheet(trip, options))[0]).toHaveLength(
      columnWidths({ trackPayers: false }).length,
    );
  });

  it("formats amounts with the currency's decimals", () => {
    expect(amountFormat("EUR")).toBe("#,##0.00");
    expect(amountFormat("JPY")).toBe("#,##0");
    expect(amountFormat("KWD")).toBe("#,##0.000");
  });

  it("names the file after the trip", () => {
    expect(exportFileName("Japon 2025")).toBe("Japon 2025.xlsx");
    expect(exportFileName(' Tokyo / Kyoto: "été" ')).toBe("Tokyo Kyoto été.xlsx");
    expect(exportFileName("///")).toBe("TEV.xlsx");
  });

  it("writes a file the spreadsheet import reads back", async () => {
    const file = await writeExcelFile(tripSheet(trip, options), {
      columns: columnWidths(trip),
    }).toBuffer();
    const [sheet] = await readExcelFile(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer,
    );
    const rows = sheet.data as Cell[][];
    const header = findHeaderRow(rows);
    const mapping = guessColumns(rows, header);
    expect(mapping).toEqual({ date: 0, label: 1, amount: 2, category: 3, notes: 9 });

    const imported = convertRows(rows, header, mapping, { currency: "EUR", dateOrder: "dmy" });
    expect(imported.skipped).toEqual([]);
    expect(imported.rows).toMatchObject([
      {
        date: "2025-03-20",
        label: "Sushiro",
        amountMinor: 2383,
        category: "Restauration",
        notes: null,
      },
      {
        date: "2025-03-20",
        label: "Shinkansen",
        amountMinor: 17541,
        category: "Transport",
        notes: null,
      },
      {
        date: "2025-03-28",
        label: "Takoyaki",
        amountMinor: 1200,
        category: "Restauration",
        notes: "Dotonbori",
      },
    ]);
  });
});
