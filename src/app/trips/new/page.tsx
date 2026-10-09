import { getLocale, getTranslations } from "next-intl/server";
import { TripForm } from "@/components/trip-form";
import { currencyOptions } from "@/lib/currencies";
import { requireSession } from "@/lib/session";

export default async function NewTripPage() {
  const [{ user }, t, locale] = await Promise.all([
    requireSession(),
    getTranslations("tripForm"),
    getLocale(),
  ]);
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t("createTitle")}</h1>
      <TripForm
        // Next keeps visited pages alive: a new key on every render starts the form afresh.
        key={crypto.randomUUID()}
        currencies={currencyOptions(locale)}
        trip={{
          name: "",
          baseCurrency: "EUR",
          startDate: null,
          endDate: null,
          participants: [{ name: user.name }],
        }}
      />
    </main>
  );
}
