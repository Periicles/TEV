import { normalize } from "@/lib/spreadsheet";

/** Text an expense can be found by: everything shown about it, without case or accents. */
export function searchText(parts: (string | null | undefined | false)[]) {
  return ` ${normalize(parts.filter(Boolean).join(" "))} `;
}

/**
 * Whether a search matches: every word of the query starts a word of the text, in any order.
 * Punctuation separates words, so "23,83" and "23.83" both find 23,83 €.
 */
export function matchesSearch(text: string, query: string) {
  return normalize(query)
    .split(" ")
    .filter(Boolean)
    .every((word) => text.includes(` ${word}`));
}
