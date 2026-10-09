import type messages from "../../messages/fr.json";

type CategoryKey = keyof (typeof messages)["categories"];
type Category = { key: string | null; name: string | null };

const categoryKeys = new Set<string>([
  "transport",
  "lodging",
  "food",
  "activities",
  "groceries",
  "other",
] satisfies CategoryKey[]);

function isCategoryKey(key: string): key is CategoryKey {
  return categoryKeys.has(key);
}

/** Built-in categories are translated from their key; custom ones show their name. */
export function categoryLabel(
  category: Category | undefined,
  t: (key: CategoryKey) => string,
  fallback: string,
) {
  if (!category) return fallback;
  if (category.key && isCategoryKey(category.key)) return t(category.key);
  return category.name ?? category.key ?? fallback;
}
