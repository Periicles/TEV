/**
 * Turns a trip into the rows of an .xlsx sheet, one row per expense, oldest first. Columns keep the
 * titles the spreadsheet import recognizes (date, label, amount, category, notes), so an exported
 * file can be imported back.
 */
import type { Cell, Row, SheetData } from "write-excel-file/node";
import { currencyDigits, toMajor } from "./money";

export interface ExportExpense {
  date: string;
  createdAt: Date;
  label: string;
  categoryId: string | null;
  amountMinor: number;
  currency: string;
  baseAmountMinor: number;
  exchangeRate: string;
  paidBy: string | null;
  paymentMethod: string | null;
  participantIds: string[];
  notes: string | null;
}

export interface ExportTrip {
  baseCurrency: string;
  trackPayers: boolean;
  participants: { id: string; name: string }[];
  expenses: ExportExpense[];
}

/** Column titles, in the user's language. */
export interface ExportLabels {
  date: string;
  label: string;
  amount: string;
  category: string;
  paymentMethod: string;
  paidBy: string;
  participants: string;
  originalAmount: string;
  currency: string;
  rate: string;
  notes: string;
}

export interface ExportOptions {
  labels: ExportLabels;
  categoryName: (categoryId: string | null) => string;
  /** Excel date format: `dd/mm/yyyy` in French, `yyyy-mm-dd` in English. */
  dateFormat: string;
}

/** Excel number format showing the currency's decimals: `#,##0.00` for EUR, `#,##0` for JPY. */
export function amountFormat(currency: string) {
  const digits = currencyDigits(currency);
  return digits ? `#,##0.${"0".repeat(digits)}` : "#,##0";
}

function money(minor: number, currency: string): Cell {
  return { value: toMajor(minor, currency), type: Number, format: amountFormat(currency) };
}

export function tripSheet(trip: ExportTrip, options: ExportOptions): SheetData {
  const { labels, categoryName, dateFormat } = options;
  const nameOf = (id: string) => trip.participants.find((p) => p.id === id)?.name ?? "";
  const titles = [
    labels.date,
    labels.label,
    labels.amount,
    labels.category,
    labels.paymentMethod,
    ...(trip.trackPayers ? [labels.paidBy] : []),
    labels.participants,
    labels.originalAmount,
    labels.currency,
    labels.rate,
    labels.notes,
  ];

  const expenses = trip.expenses.toSorted(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const rows = expenses.map((e): Row => {
    // Foreign-currency columns stay empty for expenses in the base currency.
    const foreign = e.currency !== trip.baseCurrency;
    return [
      { value: new Date(`${e.date}T00:00:00Z`), type: Date, format: dateFormat },
      e.label,
      money(e.baseAmountMinor, trip.baseCurrency),
      categoryName(e.categoryId),
      e.paymentMethod,
      ...(trip.trackPayers ? [e.paidBy ? nameOf(e.paidBy) : null] : []),
      // In the trip's order, not the order the shares were saved in.
      trip.participants
        .filter((p) => e.participantIds.includes(p.id))
        .map((p) => p.name)
        .join(", "),
      foreign ? money(e.amountMinor, e.currency) : null,
      foreign ? e.currency : null,
      foreign ? Number(e.exchangeRate) : null,
      e.notes,
    ];
  });

  return [titles.map((title): Cell => ({ value: title, fontWeight: "bold" })), ...rows];
}

/** Column widths, in characters, for the sheet's columns. */
export function columnWidths(trip: Pick<ExportTrip, "trackPayers">) {
  return [12, 32, 14, 18, 18, ...(trip.trackPayers ? [16] : []), 24, 16, 8, 10, 32].map(
    (width) => ({ width }),
  );
}

/** A file name from the trip's name: `Japon 2025.xlsx`, without characters files cannot hold. */
export function exportFileName(tripName: string) {
  const safe = tripName
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${safe || "TEV"}.xlsx`;
}
