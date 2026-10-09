import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import type { ErrorCode } from "@/i18n/errors";

/** A labelled form field with its translated error, if any. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id?: string;
  label: string;
  error?: ErrorCode;
  hint?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("errors");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={id ? `${id}-error` : undefined} className="text-sm text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );
}
