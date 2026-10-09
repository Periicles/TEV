import { getTranslations } from "next-intl/server";
import { categoryLabel } from "@/components/category-label";
import { CategoryManager } from "@/components/category-manager";
import { colorNumber } from "@/lib/category-colors";
import { requireSession } from "@/lib/session";
import { listCategories } from "@/server/trips";

export default async function CategoriesPage() {
  const { user } = await requireSession();
  const [categories, t, tCategories] = await Promise.all([
    listCategories(user.id),
    getTranslations("categoriesPage"),
    getTranslations("categories"),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("description")}</p>
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          label: categoryLabel(c, tCategories, ""),
          color: colorNumber(c),
        }))}
      />
    </main>
  );
}
