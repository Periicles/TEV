import { getTranslations } from "next-intl/server";
import { removeExpense } from "@/app/trips/actions";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseForm } from "@/components/expense-form";
import { amountInput, decimalInput, expenseFormData } from "@/server/expense-form-data";
import { loadExpensePage } from "@/server/pages";

export default async function EditExpensePage({
  params,
}: PageProps<"/trips/[tripId]/expenses/[expenseId]">) {
  const { tripId, expenseId } = await params;
  const [{ trip, categories, expense }, t] = await Promise.all([
    loadExpensePage(tripId, expenseId),
    getTranslations("expenseForm"),
  ]);
  const data = await expenseFormData(trip);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">{t("editTitle")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{trip.name}</p>
      <ExpenseForm
        key={expense.updatedAt.toISOString()}
        trip={trip}
        categories={categories}
        currencies={data.currencies}
        lastRates={data.lastRates}
        paymentMethods={data.paymentMethods}
        expense={{
          id: expense.id,
          date: expense.date,
          label: expense.label,
          amount: amountInput(expense.amountMinor, expense.currency, data.locale),
          currency: expense.currency,
          exchangeRate:
            expense.currency === trip.baseCurrency
              ? ""
              : decimalInput(Number(expense.exchangeRate), data.locale),
          rateSource: expense.rateSource,
          categoryId: expense.categoryId,
          paymentMethod: expense.paymentMethod,
          notes: expense.notes,
          participantIds: expense.participantIds,
          paidBy: expense.paidBy,
        }}
      />
      <div className="mt-8 border-t pt-4">
        <DeleteButton
          label={t("delete")}
          title={t("deleteTitle")}
          description={t("deleteDescription")}
          action={removeExpense.bind(null, expense.id)}
        />
      </div>
    </main>
  );
}
