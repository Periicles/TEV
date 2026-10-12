import type { Page } from "@playwright/test";
import { E2E_MEMBER, expect, signIn, test } from "./fixtures";

/** The visible page: Next keeps visited pages hidden in the DOM. */
const main = (page: Page) => page.getByRole("main");
const toasts = (page: Page) => page.getByRole("region", { name: /Notifications/ });

test("shares a trip with another account, who edits it then leaves", async ({
  page,
  browser,
}, testInfo) => {
  const name = `Partage ${testInfo.project.name} ${Date.now()}`;

  // The owner creates the trip and adds the member by email.
  await signIn(page);
  await page.getByRole("link", { name: "Nouveau voyage" }).click();
  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await main(page).getByRole("link", { name: "Modifier" }).click();
  await main(page).getByLabel("Email du compte").fill("personne@test.local");
  await main(page).getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(main(page).getByRole("alert")).toHaveText("Aucun compte avec cet email.");
  await main(page).getByLabel("Email du compte").fill(E2E_MEMBER.email);
  await main(page).getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(main(page).getByTestId("member").filter({ hasText: "Léa" })).toBeVisible();

  // The member sees the trip, shared by its owner, and adds an expense.
  const memberContext = await browser.newContext({
    ...testInfo.project.use,
    // Its own client IP, so its sign-in does not count against another test's rate limit.
    extraHTTPHeaders: { "x-real-ip": `10.254.${testInfo.workerIndex}.${testInfo.repeatEachIndex}` },
  });
  const member = await memberContext.newPage();
  await signIn(member, E2E_MEMBER);
  const card = main(member).getByRole("link").filter({ hasText: name });
  await expect(card.getByTestId("shared")).toHaveText("Partagé par E2E");
  await card.click();
  await member.getByRole("link", { name: "Ajouter une dépense" }).click();
  await main(member).getByLabel("Devise", { exact: true }).selectOption("EUR");
  await main(member).getByLabel("Montant", { exact: true }).fill("8");
  await main(member).getByLabel("Libellé", { exact: true }).fill("Takoyaki");
  await member.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(member.getByTestId("trip-total")).toHaveText("8,00 €");

  // A member cannot delete the trip, but can leave it.
  await main(member).getByRole("link", { name: "Modifier" }).click();
  await expect(main(member).getByRole("button", { name: "Supprimer le voyage" })).toHaveCount(0);
  await main(member).getByRole("button", { name: "Quitter le voyage" }).click();
  await member.getByRole("button", { name: "Quitter", exact: true }).click();
  await expect(toasts(member).getByText("Tu as quitté le voyage")).toBeVisible();
  await expect(main(member).getByRole("link").filter({ hasText: name })).toHaveCount(0);
  await memberContext.close();

  // The owner sees the member's expense, and no member left.
  await page.reload();
  await expect(main(page).getByTestId("member")).toHaveCount(1);
  await page.goto("/");
  await main(page).getByRole("link").filter({ hasText: name }).click();
  await expect(page.getByTestId("trip-total")).toHaveText("8,00 €");
  await expect(page.getByRole("link", { name: /Takoyaki/ })).toBeVisible();

  await main(page).getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});
