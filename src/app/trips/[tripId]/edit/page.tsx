import { getLocale, getTranslations } from "next-intl/server";
import { removeTrip } from "@/app/trips/actions";
import { DeleteButton } from "@/components/delete-button";
import { TripForm } from "@/components/trip-form";
import { currencyOptions } from "@/lib/currencies";
import { amountInput } from "@/server/expense-form-data";
import { loadTripPage } from "@/server/pages";

export default async function EditTripPage({ params }: PageProps<"/trips/[tripId]/edit">) {
  const { tripId } = await params;
  const [{ trip }, t, tTrips, locale] = await Promise.all([
    loadTripPage(tripId),
    getTranslations("tripForm"),
    getTranslations("trips"),
    getLocale(),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t("editTitle")}</h1>
      <TripForm
        key={trip.updatedAt.toISOString()}
        currencies={currencyOptions(locale, [trip.baseCurrency])}
        trip={{
          id: trip.id,
          name: trip.name,
          baseCurrency: trip.baseCurrency,
          startDate: trip.startDate,
          endDate: trip.endDate,
          trackPayers: trip.trackPayers,
          budget:
            trip.budgetMinor === null
              ? ""
              : amountInput(trip.budgetMinor, trip.baseCurrency, locale),
          showDailyTotals: trip.showDailyTotals,
          participants: trip.participants.map((p) => ({ id: p.id, name: p.name })),
        }}
      />
      <div className="mt-8 border-t pt-4">
        <DeleteButton
          label={tTrips("delete")}
          title={tTrips("deleteTitle", { name: trip.name })}
          description={tTrips("deleteDescription")}
          action={removeTrip.bind(null, trip.id)}
        />
      </div>
    </main>
  );
}
