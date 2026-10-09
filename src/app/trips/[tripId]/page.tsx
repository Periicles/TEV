import { ChevronLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { categoryLabel } from "@/components/category-label";
import { CategoryRing, chartColor } from "@/components/category-ring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, splitEvenly } from "@/lib/money";
import { loadTripPage } from "@/server/pages";

export default async function TripPage({ params }: PageProps<"/trips/[tripId]">) {
  const { tripId } = await params;
  const [{ trip, categories }, t, tTrips, tCategories, locale, format] = await Promise.all([
    loadTripPage(tripId),
    getTranslations("trip"),
    getTranslations("trips"),
    getTranslations("categories"),
    getLocale(),
    getFormatter(),
  ]);

  const money = (minor: number, currency = trip.baseCurrency) =>
    formatMoney(minor, currency, locale);
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  const { totalMinor, byParticipant, byCategory } = trip.summary;
  const participantCount = trip.participants.length;
  const categoryName = (id: string | null) =>
    categoryLabel(
      categories.find((c) => c.id === id),
      tCategories,
      t("uncategorized"),
    );
  const colorIndex = (id: string | null) => {
    const position = categories.findIndex((c) => c.id === id);
    return position >= 0 ? position : null;
  };
  const categoryTotals = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const days = Map.groupBy(trip.expenses, (e) => e.date);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-6 pb-28 lg:max-w-6xl lg:gap-8 lg:pb-12">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" />
            {tTrips("back")}
          </Link>
          <h1 className="text-2xl font-semibold">{trip.name}</h1>
          <p className="text-sm text-muted-foreground">
            {trip.participants.map((p) => p.name).join(", ")}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/trips/${trip.id}/edit`}>
            <PencilIcon />
            {tTrips("edit")}
          </Link>
        </Button>
      </div>

      {/* Desktop: summary in a sticky column on the left, expenses on the right. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardDescription>{t("total")}</CardDescription>
              <CardTitle className="neon-text text-3xl tabular-nums" data-testid="trip-total">
                {money(totalMinor)}
              </CardTitle>
              {participantCount > 1 && (
                <CardDescription className="tabular-nums" data-testid="trip-per-person">
                  {t("perPerson", { amount: money(splitEvenly(totalMinor, participantCount)[0]) })}
                </CardDescription>
              )}
            </CardHeader>
            {participantCount > 1 && totalMinor > 0 && (
              <CardContent className="grid gap-1 text-sm">
                <p className="mb-1 font-medium">{t("byParticipant")}</p>
                {trip.participants.map((p) => (
                  <div key={p.id} className="flex justify-between gap-4 tabular-nums">
                    <span>{p.name}</span>
                    <span data-testid={`share-${p.name}`}>
                      {money(byParticipant.get(p.id) ?? 0)}
                    </span>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {categoryTotals.length > 0 && (
            <section className="grid gap-3 lg:rounded-xl lg:border lg:p-6 lg:shadow-sm">
              <h2 className="font-semibold">{t("byCategory")}</h2>
              <CategoryRing
                id={trip.id}
                items={categoryTotals.map(([categoryId, amount]) => ({
                  key: categoryId ?? "none",
                  label: categoryName(categoryId),
                  value: amount,
                  amount: money(amount),
                  percent: format.number(amount / totalMinor, { style: "percent" }),
                  colorIndex: colorIndex(categoryId),
                }))}
              />
            </section>
          )}
        </aside>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">{t("expenses")}</h2>
            <Button asChild className="hidden lg:inline-flex">
              <Link href={`/trips/${trip.id}/expenses/new`}>
                <PlusIcon />
                {t("addExpense")}
              </Link>
            </Button>
          </div>
          {trip.expenses.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noExpenses")}</p>
          )}
          {[...days.entries()].map(([date, expenses]) => (
            <div key={date} className="grid gap-1">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {day(date)}
              </h3>
              <ul className="divide-y rounded-lg border">
                {expenses.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/trips/${trip.id}/expenses/${e.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent/50 lg:px-4"
                    >
                      <span
                        className="hidden size-2 shrink-0 rounded-full lg:block"
                        style={{ backgroundColor: chartColor(colorIndex(e.categoryId)) }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            categoryName(e.categoryId),
                            e.paymentMethod,
                            e.participantIds.length < participantCount &&
                              trip.participants
                                .filter((p) => e.participantIds.includes(p.id))
                                .map((p) => p.name)
                                .join(", "),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <p className="font-medium">{money(e.baseAmountMinor)}</p>
                        {e.currency !== trip.baseCurrency && (
                          <p className="text-xs text-muted-foreground">
                            {money(e.amountMinor, e.currency)}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/90 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 lg:hidden">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={`/trips/${trip.id}/expenses/new`}>
            <PlusIcon />
            {t("addExpense")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
