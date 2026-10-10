import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./fixtures";

const main = (page: Page) => page.getByRole("main");
/** The toasts, announced as a notifications region. */
const toasts = (page: Page) => page.getByRole("region", { name: /Notifications/ });

test("tells what happened and undoes deletions", async ({ page }) => {
  const name = `Annuler ${Date.now()}`;
  await signIn(page);
  await page.getByRole("link", { name: "Nouveau voyage" }).click();
  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(toasts(page).getByText("Voyage créé")).toBeVisible();

  await page.getByRole("link", { name: "Ajouter une dépense" }).click();
  await main(page).getByLabel("Devise", { exact: true }).selectOption("EUR");
  await main(page).getByLabel("Montant", { exact: true }).fill("12");
  await main(page).getByLabel("Libellé", { exact: true }).fill("Gelato");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(toasts(page).getByText("Dépense ajoutée")).toBeVisible();

  // Delete the expense, then undo.
  await page.getByRole("link", { name: /Gelato/ }).click();
  await page.getByRole("button", { name: "Supprimer la dépense" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(toasts(page).getByText("Dépense supprimée")).toBeVisible();
  await expect(page.getByTestId("trip-total")).toHaveText("0,00 €");
  await toasts(page).getByRole("button", { name: "Annuler" }).click();
  await expect(toasts(page).getByText("Dépense restaurée")).toBeVisible();
  await expect(page.getByTestId("trip-total")).toHaveText("12,00 €");
  await expect(page.getByRole("link", { name: /Gelato/ })).toBeVisible();

  // Delete the trip, then undo.
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
  await toasts(page).getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByTestId("trip-total")).toHaveText("12,00 €");

  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});
