import { currencyDigits, parseAmount } from "@/lib/money";

/**
 * Turns the rows of a spreadsheet (as read from an .xlsx file) into expenses: finds the header row,
 * guesses which column holds what, then converts each row. Pure functions, so the browser can show
 * a preview before anything is saved.
 */

export type Cell = string | number | boolean | Date | null | undefined;

export const COLUMN_ROLES = ["date", "label", "amount", "category", "notes", "perPerson"] as const;
export type ColumnRole = (typeof COLUMN_ROLES)[number];
/** Column index for each role; `label` and `amount` are required to import anything. */
export type ColumnMapping = Partial<Record<ColumnRole, number>>;

/** Order of day, month and year in dates written as text, such as `20/03/2025`. */
export type DateOrder = "dmy" | "mdy" | "ymd";

export interface ImportedRow {
  /** Row number in the sheet, starting at 1 as spreadsheets show it. */
  row: number;
  /** ISO date, or `null` when the row has none (`-`, empty or unreadable). */
  date: string | null;
  label: string;
  amountMinor: number;
  category: string | null;
  notes: string | null;
}

export type SkipReason = "noLabel" | "noAmount" | "invalidAmount";
export interface SkippedRow {
  row: number;
  reason: SkipReason;
  /** The row's non-empty cells, to recognize it (a totals row, a note…). */
  cells: string[];
}

const LABEL_MAX = 200;
const NOTES_MAX = 1000;

/** Lower case, without accents or extra spaces, to compare headers and category names. */
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isEmpty(cell: Cell) {
  return cell === null || cell === undefined || (typeof cell === "string" && !cell.trim());
}

function cellText(cell: Cell): string {
  if (isEmpty(cell)) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

/** The first row with at least two text cells: the column titles. */
export function findHeaderRow(rows: Cell[][]): number {
  const index = rows.findIndex(
    (row) => row.filter((cell) => typeof cell === "string" && cell.trim()).length >= 2,
  );
  return Math.max(index, 0);
}

/**
 * Header names for each role, normalized. Roles are matched in this order, each column at most
 * once, so "Cost per person" is taken by `perPerson` before `amount` looks for "cost".
 */
const HEADERS: [ColumnRole, string[]][] = [
  ["perPerson", ["cost per person", "per person", "par personne", "par pers", "each"]],
  ["date", ["date", "jour", "day"]],
  ["notes", ["notes", "note", "commentaire", "commentaires", "comment", "comments", "remarque"]],
  ["category", ["category", "categorie", "type", "poste"]],
  [
    "label",
    ["expense", "depense", "libelle", "label", "description", "intitule", "objet", "item", "nom"],
  ],
  ["amount", ["total cost", "amount", "montant", "cout", "cost", "prix", "price", "total"]],
];

/** Guesses the role of each column from its title, then finds the category column by its values. */
export function guessColumns(rows: Cell[][], headerRow: number): ColumnMapping {
  const header = (rows[headerRow] ?? []).map((cell) => normalize(cellText(cell)));
  const mapping: ColumnMapping = {};
  const taken = new Set<number>();
  const assign = (role: ColumnRole, matches: (title: string, name: string) => boolean) => {
    if (mapping[role] !== undefined) return;
    for (const name of HEADERS.find(([r]) => r === role)![1]) {
      const index = header.findIndex((title, i) => !taken.has(i) && title && matches(title, name));
      if (index >= 0) {
        mapping[role] = index;
        taken.add(index);
        return;
      }
    }
  };
  // Exact titles first, then titles that contain a known word ("Total cost (EUR)").
  for (const [role] of HEADERS) assign(role, (title, name) => title === name);
  for (const [role] of HEADERS) {
    assign(role, (title, name) => ` ${title} `.includes(` ${name} `));
  }

  // An untitled ("Column 1") category column: text repeating a few distinct values.
  if (mapping.category === undefined) {
    const data = rows.slice(headerRow + 1);
    const width = Math.max(0, ...rows.map((row) => row.length));
    let best: { index: number; distinct: number } | null = null;
    for (let index = 0; index < width; index++) {
      if (taken.has(index)) continue;
      const values = data.map((row) => row[index]).filter((cell) => !isEmpty(cell));
      if (values.length < 2 || !values.every((cell) => typeof cell === "string")) continue;
      const distinct = new Set(values.map((cell) => normalize(String(cell)))).size;
      const repeats = distinct < values.length && distinct <= Math.max(3, values.length / 2);
      if (repeats && (!best || distinct < best.distinct)) {
        best = { index, distinct };
      }
    }
    if (best) mapping.category = best.index;
  }
  return mapping;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;
  return date.toISOString().slice(0, 10);
}

/** A date cell as an ISO date: a date, an Excel serial number or a date written as text. */
export function parseDateCell(cell: Cell, order: DateOrder): string | null {
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime()) ? null : cell.toISOString().slice(0, 10);
  }
  if (typeof cell === "number") {
    // Excel counts days since 1899-12-30; keep to plausible travel dates.
    if (cell < 20000 || cell > 80000) return null;
    return new Date(EXCEL_EPOCH + Math.floor(cell) * 86_400_000).toISOString().slice(0, 10);
  }
  if (typeof cell !== "string") return null;

  const parts = cell.trim().match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/);
  if (!parts) return null;
  const [a, b, c] = parts.slice(1, 4).map(Number);
  const year = (value: number) => (value < 100 ? 2000 + value : value);
  if (parts[1].length === 4) return isoDate(a, b, c);
  return order === "mdy" ? isoDate(year(c), a, b) : isoDate(year(c), b, a);
}

/** An amount cell in minor units of `currency`, or `null` when it is not a number. */
export function parseAmountCell(cell: Cell, currency: string): number | null {
  if (typeof cell === "number") {
    if (!Number.isFinite(cell)) return null;
    return Math.round(cell * 10 ** currencyDigits(currency));
  }
  if (typeof cell !== "string") return null;
  // Currency symbols and codes around the number ("1 234,50 €", "$12.00").
  const text = cell.replace(/[^\d\s.,'’  -]/g, "").trim();
  return text ? parseAmount(text, currency) : null;
}

/** Converts the data rows (after the header) with the given column mapping. */
export function convertRows(
  rows: Cell[][],
  headerRow: number,
  mapping: ColumnMapping,
  options: { currency: string; dateOrder: DateOrder },
): { rows: ImportedRow[]; skipped: SkippedRow[] } {
  const imported: ImportedRow[] = [];
  const skipped: SkippedRow[] = [];
  const at = (row: Cell[], role: ColumnRole) =>
    mapping[role] === undefined ? undefined : row[mapping[role]];

  rows.forEach((cells, index) => {
    if (index <= headerRow) return;
    const row = index + 1;
    // Only the mapped columns count: side tables next to the data are ignored.
    const used = COLUMN_ROLES.flatMap((role) =>
      mapping[role] === undefined ? [] : [cellText(cells[mapping[role]])],
    ).filter(Boolean);
    if (used.length === 0) return;

    const label = cellText(at(cells, "label"));
    const amountCell = at(cells, "amount");
    const skip = (reason: SkipReason) => skipped.push({ row, reason, cells: used });
    if (!label) return skip("noLabel");
    if (isEmpty(amountCell)) return skip("noAmount");
    const amountMinor = parseAmountCell(amountCell, options.currency);
    if (amountMinor === null || amountMinor <= 0) return skip("invalidAmount");

    imported.push({
      row,
      date: parseDateCell(at(cells, "date"), options.dateOrder),
      label: label.slice(0, LABEL_MAX),
      amountMinor,
      category: cellText(at(cells, "category")) || null,
      notes: cellText(at(cells, "notes")).slice(0, NOTES_MAX) || null,
    });
  });
  return { rows: imported, skipped };
}

/**
 * How many people the spreadsheet split expenses between, from its per-person column: the most
 * common ratio between the amount and the share. `null` when it cannot tell.
 */
export function guessParticipantCount(
  rows: Cell[][],
  headerRow: number,
  mapping: ColumnMapping,
): number | null {
  if (mapping.amount === undefined || mapping.perPerson === undefined) return null;
  const counts = new Map<number, number>();
  for (const row of rows.slice(headerRow + 1)) {
    const total = row[mapping.amount];
    const share = row[mapping.perPerson];
    if (typeof total !== "number" || typeof share !== "number" || share <= 0) continue;
    const ratio = total / share;
    const rounded = Math.round(ratio);
    if (rounded < 1 || rounded > 20 || Math.abs(ratio - rounded) > 0.01) continue;
    counts.set(rounded, (counts.get(rounded) ?? 0) + 1);
  }
  const [best] = [...counts].sort((a, b) => b[1] - a[1]);
  return best ? best[0] : null;
}

/** Words that name each built-in category, in French and English. */
const CATEGORY_WORDS: Record<string, string[]> = {
  transport: ["transport", "transports", "train", "trains", "avion", "vol", "vols", "flight"],
  lodging: ["logement", "logements", "hebergement", "hotel", "hotels", "lodging", "accommodation"],
  food: ["restauration", "nourriture", "repas", "restaurant", "restaurants", "food", "meals"],
  activities: ["activites", "activite", "activities", "loisirs", "visites", "sorties"],
  groceries: ["courses", "groceries", "supermarche"],
  other: ["autres", "autre", "divers", "other", "others", "misc"],
};

/** The existing category a spreadsheet value most likely means, if any. */
export function matchCategory<C extends { id: string; key: string | null; name: string | null }>(
  value: string,
  categories: C[],
): C | undefined {
  const wanted = normalize(value);
  return (
    categories.find((c) => c.name && normalize(c.name) === wanted) ??
    categories.find((c) => c.key && (c.key === wanted || CATEGORY_WORDS[c.key]?.includes(wanted)))
  );
}

/** The date order used by a locale for numeric dates (fr: 20/03/2025, en-US: 3/20/2025). */
export function localeDateOrder(locale: string): DateOrder {
  const parts = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" })
    .formatToParts(new Date(Date.UTC(2025, 2, 20)))
    .map((part) => part.type)
    .filter((type) => type === "day" || type === "month" || type === "year");
  if (parts[0] === "year") return "ymd";
  return parts[0] === "month" ? "mdy" : "dmy";
}
