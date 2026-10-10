import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./fixtures";

const main = (page: Page) => page.getByRole("main");
const expenseLinks = (page: Page) => main(page).getByRole("link", { name: /€/ });

test("shows expenses 15 at a time and searches all of them", async ({ page }) => {
  const name = `Liste ${Date.now()}`;
  await signIn(page);
  await page.goto("/trips/import");
  await main(page).getByLabel("Fichier .xlsx").setInputFiles("e2e/fixtures/twenty-expenses.xlsx");
  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  await main(page).getByRole("button", { name: "Importer 20 dépenses" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // The newest 15 first; scrolling to the end shows the rest.
  await expect(expenseLinks(page)).toHaveCount(15);
  await main(page)
    .getByRole("button", { name: /Afficher plus \(5 restantes\)/ })
    .scrollIntoViewIfNeeded();
  await expect(expenseLinks(page)).toHaveCount(20);
  await expect(main(page).getByRole("button", { name: /Afficher plus/ })).toHaveCount(0);

  // The search covers every expense, including the oldest one.
  const search = main(page).getByRole("searchbox", { name: "Rechercher une dépense" });
  await search.fill("takoyaki");
  await expect(main(page).getByText("1 dépense trouvée")).toBeVisible();
  await expect(expenseLinks(page)).toHaveCount(1);
  await expect(main(page).getByRole("link", { name: /Takoyaki/ })).toBeVisible();
  await search.fill("dépense 0");
  await expect(main(page).getByText("9 dépenses trouvées")).toBeVisible();
  await search.fill("nothing like this");
  await expect(main(page).getByText("Aucune dépense ne correspond")).toBeVisible();
  await search.fill("");
  await expect(expenseLinks(page)).toHaveCount(15);

  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});
