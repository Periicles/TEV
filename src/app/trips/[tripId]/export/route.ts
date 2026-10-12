import { getLocale, getTranslations } from "next-intl/server";
import writeExcelFile from "write-excel-file/node";
import { categoryLabel } from "@/components/category-label";
import { getSession } from "@/lib/session";
import { columnWidths, exportFileName, tripSheet } from "@/lib/trip-export";
import { getTripDetails, listCategories, NotFoundError } from "@/server/trips";

/** Downloads the trip's expenses as an .xlsx file, which the spreadsheet import can read back. */
export async function GET(_request: Request, ctx: RouteContext<"/trips/[tripId]/export">) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const { tripId } = await ctx.params;

  let trip;
  try {
    trip = await getTripDetails(session.user.id, tripId);
  } catch (error) {
    if (error instanceof NotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
  const [categories, t, tTrip, tCategories, locale] = await Promise.all([
    listCategories(trip.userId),
    getTranslations("export"),
    getTranslations("trip"),
    getTranslations("categories"),
    getLocale(),
  ]);

  const currency = trip.baseCurrency;
  const sheet = tripSheet(trip, {
    labels: {
      date: t("date"),
      label: t("label"),
      amount: t("amount", { currency }),
      category: t("category"),
      paymentMethod: t("paymentMethod"),
      paidBy: t("paidBy"),
      participants: t("participants"),
      originalAmount: t("originalAmount"),
      currency: t("currency"),
      rate: t("rate", { currency }),
      notes: t("notes"),
    },
    categoryName: (id) =>
      categoryLabel(
        categories.find((c) => c.id === id),
        tCategories,
        tTrip("uncategorized"),
      ),
    dateFormat: locale.startsWith("fr") ? "dd/mm/yyyy" : "yyyy-mm-dd",
  });
  const file = await writeExcelFile(sheet, {
    sheet: t("sheet"),
    columns: columnWidths(trip),
    stickyRowsCount: 1,
  }).toBuffer();

  const name = exportFileName(trip.name);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // An ASCII fallback, then the real name (accents included) for browsers that read it.
      "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
