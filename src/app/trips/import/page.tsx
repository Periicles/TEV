import { getLocale, getTranslations } from "next-intl/server";
import { categoryLabel } from "@/components/category-label";
import { ImportForm } from "@/components/import-form";
import { currencyOptions } from "@/lib/currencies";
import { requireSession } from "@/lib/session";
import { listCategories } from "@/server/trips";

export default async function ImportPage() {
  const { user } = await requireSession();
  const [t, tCategories, locale, categories] = await Promise.all([
    getTranslations("import"),
    getTranslations("categories"),
    getLocale(),
    listCategories(user.id),
  ]);
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("description")}</p>
      <ImportForm
        // Next keeps visited pages alive: a new key on every render starts the form afresh.
        key={crypto.randomUUID()}
        userName={user.name}
        currencies={currencyOptions(locale)}
        categories={categories.map((c) => ({
          id: c.id,
          key: c.key,
          name: c.name,
          label: categoryLabel(c, tCategories, ""),
        }))}
      />
    </main>
  );
}
