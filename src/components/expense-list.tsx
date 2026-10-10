"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ColorDot } from "@/components/color-dot";
import { Input } from "@/components/ui/input";
import { matchesSearch } from "@/lib/expense-search";

/** An expense as listed, formatted on the server. */
export interface ExpenseRow {
  id: string;
  href: string;
  date: string;
  label: string;
  /** Category, payment method, payer and participants, joined. */
  meta: string;
  amount: string;
  /** Amount in the expense's own currency, when it differs from the trip's. */
  originalAmount: string | null;
  color: string;
  /** From `searchText`. */
  search: string;
}

const PAGE_SIZE = 15;

/**
 * The trip's expenses, newest first and grouped by day: the first 15, then 15 more each time the
 * end of the list comes into view. The search covers every expense, shown or not yet.
 */
export function ExpenseList({
  rows,
  days,
}: {
  rows: ExpenseRow[];
  /** Day headers: the date as shown and, when the trip shows them, the day's total. */
  days: Record<string, { label: string; total: string | null }>;
}) {
  const t = useTranslations("expenseList");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [shown, setShown] = useState(PAGE_SIZE);
  const sentinel = useRef<HTMLDivElement>(null);

  const matching = deferredQuery.trim()
    ? rows.filter((row) => matchesSearch(row.search, deferredQuery))
    : rows;
  const visible = matching.slice(0, shown);
  const remaining = matching.length - visible.length;
  const groups = Map.groupBy(visible, (row) => row.date);

  // Loads the next page as the end of the list scrolls into view.
  useEffect(() => {
    const target = sentinel.current;
    if (!target || remaining === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setShown((n) => n + PAGE_SIZE);
      },
      { rootMargin: "200px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [remaining]);

  return (
    <div className="grid gap-3">
      {rows.length > PAGE_SIZE / 3 && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShown(PAGE_SIZE);
            }}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            className="pl-9"
          />
        </div>
      )}

      {deferredQuery.trim() && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t("results", { count: matching.length })}
        </p>
      )}

      {[...groups.entries()].map(([date, dayRows]) => (
        <div key={date} className="grid gap-1">
          <h3 className="flex justify-between gap-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <span>{days[date]?.label}</span>
            {days[date]?.total && (
              <span className="tabular-nums" data-testid="daily-total">
                {days[date].total}
              </span>
            )}
          </h3>
          <ul className="divide-y rounded-lg border">
            {dayRows.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent/50 lg:px-4"
                >
                  <ColorDot color={row.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.meta}</p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p className="font-medium">{row.amount}</p>
                    {row.originalAmount && (
                      <p className="text-xs text-muted-foreground">{row.originalAmount}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {remaining > 0 && (
        <div ref={sentinel} className="flex justify-center py-2">
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setShown((n) => n + PAGE_SIZE)}
          >
            {t("showMore", { count: remaining })}
          </button>
        </div>
      )}
    </div>
  );
}
