import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./fixtures";

const main = (page: Page) => page.getByRole("main");

/** The row of a category, found by its name field (other runs may add categories meanwhile). */
const rowOf = (page: Page, name: string) =>
  main(page)
    .getByTestId("category")
    .filter({ has: page.getByLabel(`Nom de la catégorie ${name}`, { exact: true }) });

test("manages categories and their colors", async ({ page }, testInfo) => {
  const name = `Cadeaux ${testInfo.project.name} ${Date.now()}`;
  await signIn(page);
  await page.getByRole("button", { name: "Préférences" }).click();
  await page.getByRole("menuitem", { name: "Catégories" }).click();
  await expect(page.getByRole("heading", { name: "Catégories" })).toBeVisible();

  // Add a category with the sixth color.
  await main(page).getByLabel("Nouvelle catégorie", { exact: true }).fill(name);
  await main(page)
    .getByRole("group", { name: `Couleur de ${name}` })
    .getByRole("button", { name: "Couleur 6" })
    .click();
  await main(page).getByRole("button", { name: "Ajouter" }).click();
  const row = rowOf(page, name);
  await expect(row.getByRole("button", { name: "Couleur 6" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Recolor it.
  await row.getByRole("button", { name: "Couleur 2" }).click();
  await expect(row.getByRole("button", { name: "Couleur 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Rename it, then move it up: it is no longer the last one.
  const renamed = `${name} !`;
  await row.getByLabel(`Nom de la catégorie ${name}`).fill(renamed);
  await row.getByLabel(`Nom de la catégorie ${name}`).press("Enter");
  const renamedRow = rowOf(page, renamed);
  await expect(renamedRow).toBeVisible();
  await renamedRow.getByRole("button", { name: `Monter ${renamed}` }).click();
  await expect(renamedRow.getByRole("button", { name: `Descendre ${renamed}` })).toBeEnabled();

  // Delete it.
  await renamedRow.getByRole("button", { name: `Supprimer ${renamed}` }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(renamedRow).toHaveCount(0);
});
