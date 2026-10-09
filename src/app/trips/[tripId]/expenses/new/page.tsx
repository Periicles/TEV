import { getTranslations } from "next-intl/server";
import { ExpenseForm } from "@/components/expense-form";
import { expenseFormData } from "@/server/expense-form-data";
import { loadTripPage } from "@/server/pages";

export default async function NewExpensePage({
  params,
}: PageProps<"/trips/[tripId]/expenses/new">) {
  const { tripId } = await params;
  const [{ trip, categories }, t] = await Promise.all([
    loadTripPage(tripId),
    getTranslations("expenseForm"),
  ]);
  const data = await expenseFormData(trip);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">{t("createTitle")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{trip.name}</p>
      <ExpenseForm
        // Next keeps visited pages alive: a new key on every render starts the form afresh.
        key={crypto.randomUUID()}
        trip={trip}
        categories={categories}
        currencies={data.currencies}
        lastRates={data.lastRates}
        paymentMethods={data.paymentMethods}
        expense={{
          date: data.today,
          label: "",
          amount: "",
          currency: data.lastCurrency,
          exchangeRate: data.lastRates[data.lastCurrency] ?? "",
          rateSource: "manual",
          categoryId: null,
          paymentMethod: null,
          notes: null,
          participantIds: trip.participants.map((p) => p.id),
          paidBy: trip.trackPayers ? data.lastPayer : null,
        }}
      />
    </main>
  );
}
