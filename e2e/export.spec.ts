import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./fixtures";

/** The visible page: Next keeps visited pages hidden in the DOM. */
const main = (page: Page) => page.getByRole("main");

async function importFile(page: Page, file: string, name: string) {
  await page.goto("/trips/import");
  await main(page).getByLabel("Fichier .xlsx").setInputFiles(file);
  await expect(main(page).getByTestId("import-summary")).toHaveText(
    /^4 dépenses · Total 786,33\s€$/,
  );
  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  // The original file splits expenses between two people; the export lists them by name instead.
  const second = main(page).getByLabel("Prénom du participant 2");
  if (await second.count()) await second.fill("Léa");
  // An existing category rather than a new one, so runs do not pile categories up.
  const extras = main(page).getByLabel("Extras", { exact: true });
  if (await extras.count()) await extras.selectOption({ label: "Activités" });
  await main(page).getByRole("button", { name: "Importer 4 dépenses" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function deleteTrip(page: Page) {
  await main(page).getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
}

test("exports a trip to a spreadsheet that imports back", async ({ page }, testInfo) => {
  const name = `Export ${testInfo.project.name} ${Date.now()}`;
  await signIn(page);
  await importFile(page, "e2e/fixtures/budget.xlsx", name);

  const download = page.waitForEvent("download");
  await main(page).getByRole("link", { name: "Exporter" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${name}.xlsx`);
  const path = testInfo.outputPath("export.xlsx");
  await file.saveAs(path);
  await deleteTrip(page);

  // The same expenses, total and categories come back.
  await importFile(page, path, `${name} (copie)`);
  await expect(page.getByTestId("trip-total")).toHaveText("786,33 €");
  await expect(page.getByRole("link", { name: /Suica/ })).toBeVisible();
  await deleteTrip(page);
});

test("only exports the user's own trips", async ({ page }) => {
  await signIn(page);
  const response = await page.request.get("/trips/00000000-0000-4000-8000-000000000000/export");
  expect(response.status()).toBe(404);
});
