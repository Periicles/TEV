"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { importSpreadsheet } from "@/app/trips/actions";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ErrorCode } from "@/i18n/errors";
import { formatMoney } from "@/lib/money";
import {
  convertRows,
  findHeaderRow,
  guessColumns,
  guessParticipantCount,
  localeDateOrder,
  matchCategory,
  normalize,
  type Cell,
  type ColumnMapping,
  type ColumnRole,
} from "@/lib/spreadsheet";

interface Sheet {
  name: string;
  rows: Cell[][];
}

/** Where a spreadsheet category goes: an existing category, a new one, or none. */
type CategoryChoice = { existing: string } | "new" | "none";

const MAPPED_ROLES = ["date", "label", "amount", "category", "notes"] as const;
const ID = "import";

function columnName(index: number) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

export function ImportForm({
  userName,
  categories,
  currencies,
}: {
  userName: string;
  categories: { id: string; key: string | null; name: string | null; label: string }[];
  currencies: { code: string; label: string }[];
}) {
  const t = useTranslations("import");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const format = useFormatter();
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [readError, setReadError] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [participants, setParticipants] = useState([userName]);
  const [payer, setPayer] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [categoryChoices, setCategoryChoices] = useState<Record<string, CategoryChoice>>({});
  const [undatedDate, setUndatedDate] = useState("");
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const dateOrder = localeDateOrder(locale);

  const sheet = sheets?.[sheetIndex];
  const headerRow = sheet ? findHeaderRow(sheet.rows) : 0;
  const converted = useMemo(
    () => (sheet ? convertRows(sheet.rows, headerRow, mapping, { currency, dateOrder }) : null),
    [sheet, headerRow, mapping, currency, dateOrder],
  );
  const spreadsheetCategories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of converted?.rows ?? []) {
      if (row.category && !seen.has(normalize(row.category))) {
        seen.set(normalize(row.category), row.category);
      }
    }
    return [...seen.values()];
  }, [converted]);
  const choiceFor = (value: string): CategoryChoice => {
    const chosen = categoryChoices[normalize(value)];
    if (chosen) return chosen;
    const match = matchCategory(value, categories);
    return match ? { existing: match.id } : "new";
  };

  /** Guesses everything from a sheet; the user then adjusts. */
  function applySheet(all: Sheet[], index: number, fileName?: string) {
    const rows = all[index].rows;
    const header = findHeaderRow(rows);
    const columns = guessColumns(rows, header);
    const count = guessParticipantCount(rows, header, columns) ?? 1;
    const dates = convertRows(rows, header, columns, { currency, dateOrder })
      .rows.flatMap((row) => (row.date ? [row.date] : []))
      .sort();
    setSheets(all);
    setSheetIndex(index);
    setMapping(columns);
    setCategoryChoices({});
    setUndatedDate(dates.at(-1) ?? "");
    setParticipants((list) =>
      Array.from({ length: Math.max(count, 1) }, (_, i) => list[i] ?? (i === 0 ? userName : "")),
    );
    if (fileName !== undefined) setName(fileName.replace(/\.[^.]+$/, "").trim());
    setError(null);
  }

  async function readFile(file: File | undefined) {
    setReadError(false);
    if (!file) return;
    try {
      const { default: readExcelFile } = await import("read-excel-file/universal");
      const read = await readExcelFile(await file.arrayBuffer());
      const all = read.map((s) => ({ name: s.sheet, rows: s.data as Cell[][] }));
      if (all.length === 0) throw new Error("No sheet");
      applySheet(all, 0, file.name);
    } catch (cause) {
      console.warn("Cannot read spreadsheet:", cause);
      setSheets(null);
      setReadError(true);
    }
  }

  const rows = converted?.rows ?? [];
  const undated = rows.filter((row) => !row.date);
  const total = rows.reduce((sum, row) => sum + row.amountMinor, 0);
  const headers = sheet?.rows[headerRow] ?? [];
  const width = Math.max(0, ...(sheet?.rows.map((row) => row.length) ?? []));
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.label ?? "";
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), { timeZone: "UTC", dateStyle: "medium" });
  const ready =
    mapping.label !== undefined &&
    mapping.amount !== undefined &&
    rows.length > 0 &&
    (undated.length === 0 || Boolean(undatedDate));

  function submit() {
    if (!name.trim() || participants.some((p) => !p.trim())) {
      setError("required");
      return;
    }
    const newCategories: string[] = [];
    const expenses = rows.map((row) => {
      const choice = row.category ? choiceFor(row.category) : "none";
      let newCategory: number | null = null;
      if (choice === "new") {
        const index = newCategories.findIndex((c) => normalize(c) === normalize(row.category!));
        newCategory = index >= 0 ? index : newCategories.push(row.category!.slice(0, 50)) - 1;
      }
      return {
        date: row.date ?? undatedDate,
        label: row.label,
        amountMinor: row.amountMinor,
        categoryId: typeof choice === "object" ? choice.existing : null,
        newCategory,
        notes: row.notes,
      };
    });
    setError(null);
    startTransition(async () => {
      const result = await importSpreadsheet({
        trip: {
          name: name.trim(),
          baseCurrency: currency,
          startDate: startDate || null,
          endDate: endDate || null,
          participants: participants.map((p) => ({ name: p.trim() })),
        },
        paidBy: payer === "" || Number(payer) >= participants.length ? null : Number(payer),
        newCategories,
        expenses,
      });
      // Only failures come back: success redirects to the new trip.
      if (result?.error) setError(result.error);
      else if (result?.fields) setError(result.fields.endDate ?? "importInvalid");
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <Field id={`${ID}-file`} label={t("file")} hint={t("fileHint")}>
        <Input
          id={`${ID}-file`}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => readFile(event.target.files?.[0])}
        />
      </Field>
      {readError && (
        <p role="alert" className="-mt-6 text-sm text-destructive">
          {t("readError")}
        </p>
      )}

      {sheets && sheet && converted && (
        <>
          {sheets.length > 1 && (
            <Field id={`${ID}-sheet`} label={t("sheet")}>
              <NativeSelect
                id={`${ID}-sheet`}
                value={sheetIndex}
                onChange={(event) => applySheet(sheets, Number(event.target.value))}
                wrapperClassName="w-full"
              >
                {sheets.map((s, index) => (
                  <NativeSelectOption key={index} value={index}>
                    {s.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}

          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">{t("columns")}</h2>
            <div className="grid grid-cols-2 gap-3">
              {MAPPED_ROLES.map((role: ColumnRole) => (
                <Field key={role} id={`${ID}-column-${role}`} label={t(`roles.${role}`)}>
                  <NativeSelect
                    id={`${ID}-column-${role}`}
                    value={mapping[role] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setMapping((current) => {
                        const next = { ...current };
                        if (value === "") delete next[role];
                        else next[role] = Number(value);
                        return next;
                      });
                    }}
                    wrapperClassName="w-full"
                  >
                    <NativeSelectOption value="">{t("noColumn")}</NativeSelectOption>
                    {Array.from({ length: width }, (_, index) => (
                      <NativeSelectOption key={index} value={index}>
                        {[columnName(index), String(headers[index] ?? "").trim()]
                          .filter(Boolean)
                          .join(" · ")}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ))}
            </div>
          </section>

          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">{t("trip")}</h2>
            <Field id={`${ID}-name`} label={t("name")}>
              <Input
                id={`${ID}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field id={`${ID}-currency`} label={t("currency")} hint={t("currencyHint")}>
              <NativeSelect
                id={`${ID}-currency`}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                wrapperClassName="w-full"
              >
                {currencies.map((c) => (
                  <NativeSelectOption key={c.code} value={c.code}>
                    {c.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id={`${ID}-start`} label={t("startDate")}>
                <Input
                  id={`${ID}-start`}
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </Field>
              <Field id={`${ID}-end`} label={t("endDate")}>
                <Input
                  id={`${ID}-end`}
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </Field>
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">{t("participants")}</legend>
              <p className="-mt-1 text-xs text-muted-foreground">{t("participantsHint")}</p>
              {participants.map((p, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={p}
                    aria-label={t("participantName", { number: index + 1 })}
                    onChange={(event) =>
                      setParticipants((list) =>
                        list.map((item, i) => (i === index ? event.target.value : item)),
                      )
                    }
                  />
                  {participants.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("removeParticipant", { number: index + 1 })}
                      onClick={() => setParticipants((list) => list.filter((_, i) => i !== index))}
                    >
                      <XIcon />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="justify-self-start"
                onClick={() => setParticipants((list) => [...list, ""])}
              >
                <PlusIcon />
                {t("addParticipant")}
              </Button>
            </fieldset>
            {participants.length > 1 && (
              <Field id={`${ID}-payer`} label={t("paidBy")} hint={t("paidByHint")}>
                <NativeSelect
                  id={`${ID}-payer`}
                  value={Number(payer) < participants.length ? payer : ""}
                  onChange={(event) => setPayer(event.target.value)}
                  wrapperClassName="w-full"
                >
                  <NativeSelectOption value="">{t("paidByUnknown")}</NativeSelectOption>
                  {participants.map((p, index) => (
                    <NativeSelectOption key={index} value={String(index)}>
                      {p.trim() || t("participantName", { number: index + 1 })}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </section>

          {spreadsheetCategories.length > 0 && (
            <section className="grid gap-4">
              <h2 className="text-lg font-semibold">{t("categories")}</h2>
              <div className="grid gap-3">
                {spreadsheetCategories.map((value, index) => {
                  const choice = choiceFor(value);
                  return (
                    <div key={value} className="grid grid-cols-2 items-center gap-3">
                      <label htmlFor={`${ID}-category-${index}`} className="truncate text-sm">
                        {value}
                      </label>
                      <NativeSelect
                        id={`${ID}-category-${index}`}
                        value={typeof choice === "object" ? `existing:${choice.existing}` : choice}
                        onChange={(event) => {
                          const v = event.target.value;
                          const next: CategoryChoice = v.startsWith("existing:")
                            ? { existing: v.slice("existing:".length) }
                            : (v as "new" | "none");
                          setCategoryChoices((all) => ({ ...all, [normalize(value)]: next }));
                        }}
                        wrapperClassName="w-full"
                      >
                        {categories.map((c) => (
                          <NativeSelectOption key={c.id} value={`existing:${c.id}`}>
                            {c.label}
                          </NativeSelectOption>
                        ))}
                        <NativeSelectOption value="new">
                          {t("newCategory", { name: value })}
                        </NativeSelectOption>
                        <NativeSelectOption value="none">{t("noCategory")}</NativeSelectOption>
                      </NativeSelect>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">{t("preview")}</h2>
            <p data-testid="import-summary" className="font-medium">
              {t("summary", { count: rows.length, total: formatMoney(total, currency, locale) })}
            </p>

            {undated.length > 0 && (
              <Field id={`${ID}-undated`} label={t("undatedDate")}>
                <Input
                  id={`${ID}-undated`}
                  type="date"
                  value={undatedDate}
                  onChange={(event) => setUndatedDate(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("undatedHint", {
                    count: undated.length,
                    labels: undated
                      .slice(0, 4)
                      .map((row) => row.label)
                      .join(", "),
                  })}
                </p>
              </Field>
            )}

            <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border text-sm">
              {rows.map((row) => {
                const choice = row.category ? choiceFor(row.category) : "none";
                return (
                  <li key={row.row} className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          row.date ? day(row.date) : t("noDate"),
                          typeof choice === "object"
                            ? categoryName(choice.existing)
                            : choice === "new"
                              ? row.category
                              : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums">
                      {formatMoney(row.amountMinor, currency, locale)}
                    </span>
                  </li>
                );
              })}
            </ul>

            {converted.skipped.length > 0 && (
              <div className="grid gap-1 text-xs text-muted-foreground">
                <p className="font-medium">{t("skipped", { count: converted.skipped.length })}</p>
                <ul className="grid gap-1">
                  {converted.skipped.map((s) => (
                    <li key={s.row}>
                      {t("skippedRow", {
                        row: s.row,
                        reason: t(`reasons.${s.reason}`),
                        cells: s.cells.join(" · "),
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {mapping.label === undefined || mapping.amount === undefined ? (
            <p className="text-sm text-destructive">{t("columnsRequired")}</p>
          ) : null}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {tErrors(error)}
            </p>
          )}
          <Button type="button" size="lg" disabled={!ready || pending} onClick={submit}>
            {t("submit", { count: rows.length })}
          </Button>
        </>
      )}
    </div>
  );
}
