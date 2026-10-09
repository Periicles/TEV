import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./fixtures";

/**
 * The visible page. Next keeps visited pages hidden in the DOM, so fields are looked up inside the
 * visible <main> (role queries skip hidden content) rather than in the whole document.
 */
const main = (page: Page) => page.getByRole("main");

/** Fills the expense form. */
async function addExpense(
  page: Page,
  expense: {
    amount: string;
    currency: string;
    rate?: string;
    label: string;
    date: string;
    category: string;
  },
  options: { onlyFor?: string } = {},
) {
  await page.getByRole("link", { name: "Ajouter une dépense" }).click();
  await main(page).getByLabel("Devise", { exact: true }).selectOption(expense.currency);
  await main(page).getByLabel("Montant", { exact: true }).fill(expense.amount);
  if (expense.rate)
    await main(page).getByLabel("Taux de change", { exact: true }).fill(expense.rate);
  await main(page).getByLabel("Libellé", { exact: true }).fill(expense.label);
  await main(page).getByLabel("Date", { exact: true }).fill(expense.date);
  await main(page)
    .getByLabel("Catégorie", { exact: true })
    .selectOption({ label: expense.category });
  if (options.onlyFor) {
    for (const box of await page.getByRole("checkbox").all()) {
      const name = await box.getAttribute("id");
      const label = name ? await page.locator(`label[for="${name}"]`).textContent() : null;
      if (label !== options.onlyFor) await box.uncheck();
    }
  }
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dépenses" })).toBeVisible();
}

test("tracks a trip's expenses in several currencies, split between participants", async ({
  page,
}) => {
  const name = `Japon ${Date.now()}`;
  await signIn(page);

  await page.getByRole("link", { name: "Nouveau voyage" }).click();
  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  await main(page).getByLabel("Prénom du participant 1").fill("Paul");
  await page.getByRole("button", { name: "Ajouter un participant" }).click();
  await main(page).getByLabel("Prénom du participant 2").fill("Léa");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await addExpense(page, {
    amount: "3 850",
    currency: "JPY",
    rate: "161,56",
    label: "Sushiro",
    date: "2025-03-20",
    category: "Restauration",
  });
  await addExpense(
    page,
    {
      amount: "366,64",
      currency: "EUR",
      label: "Ryokan",
      date: "2025-03-07",
      category: "Logement",
    },
    { onlyFor: "Paul" },
  );

  await expect(page.getByTestId("trip-total")).toHaveText("390,47 €");
  await expect(page.getByTestId("trip-per-person")).toHaveText("Par personne : 195,24 €");
  await expect(page.getByTestId("share-Paul")).toHaveText("378,56 €");
  await expect(page.getByTestId("share-Léa")).toHaveText("11,91 €");
  await expect(page.getByTestId("category-Logement")).toHaveText(/^Logement366,64\s€ · 94\s%$/);
  await expect(page.getByTestId("category-Restauration")).toHaveText(
    /^Restauration23,83\s€ · 6\s%$/,
  );
  await expect(page.getByRole("link", { name: /Sushiro.*3\s?850 JPY/ })).toBeVisible();

  // The next expense defaults to the last currency used; the official rate replaces the last one.
  await page.getByRole("link", { name: "Ajouter une dépense" }).click();
  await expect(main(page).getByLabel("Devise", { exact: true })).toHaveValue("EUR");
  await main(page).getByLabel("Devise", { exact: true }).selectOption("JPY");
  await expect(main(page).getByLabel("Taux de change", { exact: true })).toHaveValue("160");
  await page.getByRole("link", { name: "TEV" }).click();
  await page.getByRole("link", { name: new RegExp(name) }).click();

  // Edit, then delete an expense.
  await page.getByRole("link", { name: /Sushiro/ }).click();
  await main(page).getByLabel("Montant", { exact: true }).fill("5 000");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("trip-total")).toHaveText("397,59 €");

  await page.getByRole("link", { name: /Ryokan/ }).click();
  await page.getByRole("button", { name: "Supprimer la dépense" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByTestId("trip-total")).toHaveText("30,95 €");

  // Delete the trip.
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
});

test("keeps typed values and explains errors", async ({ page }) => {
  const name = `Erreurs ${Date.now()}`;
  await signIn(page);
  await page.getByRole("link", { name: "Nouveau voyage" }).click();
  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // No official rate exists for this currency: it has to be typed in.
  await page.getByRole("link", { name: "Ajouter une dépense" }).click();
  await main(page).getByLabel("Devise", { exact: true }).selectOption("VND");
  await expect(main(page).getByTestId("rate-status")).toHaveText(
    "Pas de taux officiel pour cette devise à cette date : saisis-le.",
  );
  await main(page).getByLabel("Montant", { exact: true }).fill("1 300 000");
  await main(page).getByLabel("Libellé", { exact: true }).fill("Pho");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  await expect(page.getByText("Indique le taux de change.")).toBeVisible();
  await expect(main(page).getByLabel("Libellé", { exact: true })).toHaveValue("Pho");

  await main(page).getByLabel("Taux de change", { exact: true }).fill("26 000");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByTestId("trip-total")).toHaveText("50,00 €");

  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});

test("suggests the official rate and keeps it when saving", async ({ page }) => {
  const name = `Taux ${Date.now()}`;
  await signIn(page);
  await page.getByRole("link", { name: "Nouveau voyage" }).click();
  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("link", { name: "Ajouter une dépense" }).click();
  await main(page).getByLabel("Date", { exact: true }).fill("2025-03-20");
  await main(page).getByLabel("Devise", { exact: true }).selectOption("JPY");
  await expect(main(page).getByLabel("Taux de change", { exact: true })).toHaveValue("160");
  await expect(main(page).getByTestId("rate-status")).toHaveText("Taux officiel du 20 mars 2025.");

  // Typing a rate makes it manual, and the official one can be restored.
  await main(page).getByLabel("Taux de change", { exact: true }).fill("150");
  await expect(main(page).getByTestId("rate-status")).toContainText("Taux saisi à la main.");
  await main(page).getByRole("button", { name: "Utiliser le taux officiel (160)" }).click();
  await expect(main(page).getByLabel("Taux de change", { exact: true })).toHaveValue("160");

  await main(page).getByLabel("Montant", { exact: true }).fill("3 850");
  await expect(main(page).getByTestId("converted")).toHaveText("≈ 24,06 €");
  await main(page).getByLabel("Libellé", { exact: true }).fill("Sushiro");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByTestId("trip-total")).toHaveText("24,06 €");

  await page.getByRole("link", { name: /Sushiro/ }).click();
  await expect(main(page).getByTestId("rate-status")).toHaveText("Taux officiel du 20 mars 2025.");

  await page.getByRole("link", { name: "TEV" }).click();
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});
