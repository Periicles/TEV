import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./fixtures";

/** The visible page: Next keeps visited pages hidden in the DOM. */
const main = (page: Page) => page.getByRole("main");

test("creates a trip from a spreadsheet", async ({ page }) => {
  const name = `Import ${Date.now()}`;
  await signIn(page);
  await page.getByRole("link", { name: "Importer" }).click();
  await expect(page.getByRole("heading", { name: "Importer un tableur" })).toBeVisible();

  await main(page).getByLabel("Fichier .xlsx").setInputFiles("e2e/fixtures/budget.xlsx");

  // Everything is guessed from the file: columns, travellers (amount ÷ per person), categories.
  await expect(main(page).getByTestId("import-summary")).toHaveText(
    /^4 dépenses · Total 786,33\s€$/,
  );
  await expect(main(page).getByLabel("Libellé", { exact: true })).toHaveValue("1");
  await expect(main(page).getByLabel("Nom", { exact: true })).toHaveValue("budget");
  await expect(main(page).getByLabel("Prénom du participant 1")).toHaveValue("E2E");
  await expect(main(page).getByLabel("Prénom du participant 2")).toHaveValue("");
  await expect(main(page).getByLabel("Transport", { exact: true })).toHaveValue(/^existing:/);
  await expect(main(page).getByLabel("Date des lignes sans date")).toHaveValue("2025-03-20");
  await expect(main(page).getByText("Ligne 6 : pas de libellé (786.33 · 393.165)")).toBeVisible();

  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  await main(page).getByLabel("Prénom du participant 2").fill("Léa");
  // An existing category rather than a new one, so runs do not pile categories up.
  await main(page).getByLabel("Extras", { exact: true }).selectOption({ label: "Activités" });
  await main(page).getByRole("button", { name: "Importer 4 dépenses" }).click();

  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByTestId("trip-total")).toHaveText("786,33 €");
  await expect(page.getByTestId("trip-per-person")).toHaveText("Par personne : 393,17 €");
  await expect(page.getByRole("link", { name: /Suica/ })).toBeVisible();

  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});

test("explains a file that cannot be read", async ({ page }) => {
  await signIn(page);
  await page.goto("/trips/import");
  await main(page)
    .getByLabel("Fichier .xlsx")
    .setInputFiles({ name: "notes.xlsx", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(main(page).getByRole("alert")).toHaveText(
    "Ce fichier n'a pas pu être lu. Enregistre-le au format .xlsx et réessaie.",
  );
});
