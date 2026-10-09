import { FileSpreadsheetIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { listTrips } from "@/server/trips";

export default async function Home() {
  const { user } = await requireSession();
  const [trips, t, locale, format] = await Promise.all([
    listTrips(user.id),
    getTranslations("trips"),
    getLocale(),
    getFormatter(),
  ]);
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), { timeZone: "UTC", dateStyle: "medium" });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/trips/import">
              <FileSpreadsheetIcon />
              {/* Icon only on small screens, where both buttons do not fit next to the title. */}
              <span className="sr-only sm:not-sr-only">{t("import")}</span>
            </Link>
          </Button>
          <Button asChild>
            <Link href="/trips/new">
              <PlusIcon />
              {t("new")}
            </Link>
          </Button>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">{t("empty")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link href={`/trips/${trip.id}`} className="block rounded-xl focus-visible:outline-2">
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle>{trip.name}</CardTitle>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(trip.totalMinor, trip.baseCurrency, locale)}
                      </span>
                    </div>
                    <CardDescription>
                      {[
                        trip.startDate &&
                          (trip.endDate
                            ? format.dateTimeRange(
                                new Date(`${trip.startDate}T00:00:00Z`),
                                new Date(`${trip.endDate}T00:00:00Z`),
                                { timeZone: "UTC", dateStyle: "medium" },
                              )
                            : day(trip.startDate)),
                        t("participantCount", { count: trip.participantCount }),
                        t("expenseCount", { count: trip.expenseCount }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
