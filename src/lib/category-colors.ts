/** Number of `--chart-*` colors in globals.css. */
export const PALETTE_SIZE = 8;

/**
 * A category's palette color, 1 to 8: the one chosen, or else one following its position, so
 * every category has a color that stays the same on all trips.
 */
export function colorNumber(category: { color: number | null; position: number }): number {
  return category.color ?? (category.position % PALETTE_SIZE) + 1;
}

/** The CSS color of a palette number; grey for expenses without a category. */
export function chartColor(number: number | null): string {
  return number === null ? "var(--muted-foreground)" : `var(--chart-${number})`;
}
