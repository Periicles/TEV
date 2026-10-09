"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  addCategory,
  recolorCategory,
  removeCategory,
  renameCategory,
  reorderCategory,
} from "@/app/categories/actions";
import { ColorDot } from "@/components/color-dot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ErrorCode } from "@/i18n/errors";
import { chartColor, PALETTE_SIZE } from "@/lib/category-colors";
import { cn } from "@/lib/utils";

export interface ManagedCategory {
  id: string;
  label: string;
  color: number;
}

const COLORS = Array.from({ length: PALETTE_SIZE }, (_, i) => i + 1);

/** The eight palette colors as toggle buttons. */
function ColorPicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (color: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const t = useTranslations("categoriesPage");
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          disabled={disabled}
          aria-label={t("color", { number: color })}
          aria-pressed={color === value}
          onClick={() => onChange(color)}
          className={cn(
            "grid size-7 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            color === value && "ring-2 ring-foreground/70",
          )}
        >
          <span
            className="grid size-5 place-items-center rounded-full text-background"
            style={{
              backgroundColor: chartColor(color),
              boxShadow: `0 0 6px ${chartColor(color)}`,
            }}
          >
            {color === value && <CheckIcon className="size-3" strokeWidth={3} />}
          </span>
        </button>
      ))}
    </div>
  );
}

export function CategoryManager({ categories }: { categories: ManagedCategory[] }) {
  const t = useTranslations("categoriesPage");
  const tErrors = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);
  const [newName, setNewName] = useState("");
  // The next color in the palette, so new categories stand out from the last ones.
  const [newColor, setNewColor] = useState(() => (categories.length % PALETTE_SIZE) + 1);

  /** Runs a server action; the page refreshes with the result. */
  const run = (action: () => Promise<ErrorCode | undefined>, after?: () => void) =>
    startTransition(async () => {
      const failure = await action();
      setError(failure ?? null);
      if (!failure) after?.();
    });

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-3">
        {categories.map((c, index) => (
          <li key={c.id} className="grid gap-3 rounded-lg border p-3" data-testid="category">
            <div className="flex items-center gap-2">
              <ColorDot color={chartColor(c.color)} className="mx-1 size-3" />
              <Input
                // A new label (after a rename elsewhere) resets the field.
                key={c.label}
                defaultValue={c.label}
                aria-label={t("name", { name: c.label })}
                className="h-9"
                disabled={pending}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                onBlur={(event) => {
                  const name = event.currentTarget.value.trim();
                  if (name && name !== c.label) run(() => renameCategory(c.id, name));
                  else event.currentTarget.value = c.label;
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={pending || index === 0}
                aria-label={t("moveUp", { name: c.label })}
                onClick={() => run(() => reorderCategory(c.id, "up"))}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending || index === categories.length - 1}
                aria-label={t("moveDown", { name: c.label })}
                onClick={() => run(() => reorderCategory(c.id, "down"))}
              >
                <ArrowDownIcon />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    disabled={pending}
                    aria-label={t("delete", { name: c.label })}
                  >
                    <Trash2Icon />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteTitle", { name: c.label })}</AlertDialogTitle>
                    <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => run(() => removeCategory(c.id))}
                    >
                      {t("confirmDelete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <ColorPicker
              value={c.color}
              label={t("colors", { name: c.label })}
              disabled={pending}
              onChange={(color) => color !== c.color && run(() => recolorCategory(c.id, color))}
            />
          </li>
        ))}
      </ul>

      <form
        className="grid gap-3 rounded-lg border border-dashed p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const name = newName.trim();
          if (!name) return setError("required");
          run(
            () => addCategory(name, newColor),
            () => {
              setNewName("");
              setNewColor((color) => (color % PALETTE_SIZE) + 1);
            },
          );
        }}
      >
        <Label htmlFor="new-category">{t("newName")}</Label>
        <div className="flex gap-2">
          <Input
            id="new-category"
            value={newName}
            placeholder={t("newNamePlaceholder")}
            onChange={(event) => setNewName(event.target.value)}
          />
          <Button type="submit" disabled={pending}>
            <PlusIcon />
            {t("add")}
          </Button>
        </div>
        <ColorPicker
          value={newColor}
          label={t("colors", { name: newName || t("newName") })}
          onChange={setNewColor}
        />
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(error)}
        </p>
      )}
    </div>
  );
}
