import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** How much of a budget is spent: a glowing bar, red once the budget is exceeded. */
export function BudgetBar({
  spentMinor,
  budgetMinor,
  format,
  compact = false,
  className,
}: {
  spentMinor: number;
  budgetMinor: number;
  format: (minor: number) => string;
  /** Only the bar and what is left, for trip cards. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("budget");
  const over = spentMinor > budgetMinor;
  const share = Math.min(spentMinor / budgetMinor, 1);
  const color = over ? "var(--destructive)" : "var(--primary)";

  return (
    <div className={cn("grid gap-1.5", className)} data-testid="budget">
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={t("label")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${share * 100}%`,
            backgroundColor: color,
            boxShadow: over ? "none" : "0 0 8px var(--primary-glow)",
          }}
        />
      </div>
      <p className="flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
        {!compact && <span>{t("of", { budget: format(budgetMinor) })}</span>}
        <span className={cn(over && "font-medium text-destructive")} data-testid="budget-left">
          {over
            ? t("over", { amount: format(spentMinor - budgetMinor) })
            : t("left", { amount: format(budgetMinor - spentMinor) })}
        </span>
      </p>
    </div>
  );
}
