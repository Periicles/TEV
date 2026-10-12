import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./fixtures";

/** An iPhone 12 mini, the narrowest phone the app is checked on. */
test.use({ viewport: { width: 375, height: 812 } });

const main = (page: Page) => page.getByRole("main");

/** How far the page reaches past the right edge of the screen, in CSS pixels. */
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("fits a narrow phone, long names included", async ({ page }, testInfo) => {
  const name = `Japon 2025 — Tokyo, Kyoto et Osaka ${testInfo.project.name} ${Date.now()}`;
  await signIn(page);
  await page.getByRole("link", { name: "Nouveau voyage" }).click();
  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("link", { name: "Ajouter une dépense" }).click();
  await main(page).getByLabel("Devise", { exact: true }).selectOption("EUR");
  await main(page).getByLabel("Montant", { exact: true }).fill("175,41");
  await main(page)
    .getByLabel("Libellé", { exact: true })
    .fill("Shinkansen Tokyo → Kyoto (Nozomi, voiture 7, places réservées)");
  await main(page).getByLabel("Moyen de paiement").fill("Carte Revolut");
  expect(await overflow(page)).toBe(0);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  // The trip page, with a label longer than the screen.
  await expect(page.getByTestId("trip-total")).toHaveText("175,41 €");
  expect(await overflow(page)).toBe(0);
  await main(page).getByRole("link", { name: "Modifier" }).click();
  expect(await overflow(page)).toBe(0);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
  expect(await overflow(page)).toBe(0);

  await main(page).getByRole("link").filter({ hasText: name }).click();
  await main(page).getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});
