import type { Page } from "@playwright/test";
import { E2E_MEMBER, E2E_USER, expect, signIn, test } from "./fixtures";

/** The visible page: Next keeps visited pages hidden in the DOM. */
const main = (page: Page) => page.getByRole("main");
const toasts = (page: Page) => page.getByRole("region", { name: /Notifications/ });

test("shares a trip with a participant's account, who edits it then leaves", async ({
  page,
  browser,
}, testInfo) => {
  const name = `Partage ${testInfo.project.name} ${Date.now()}`;

  // The owner creates the trip: they are its first participant, with their own account.
  await signIn(page);
  await page.getByRole("link", { name: "Nouveau voyage" }).click();
  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  await expect(main(page).getByLabel("Email du compte du participant 1")).toHaveValue(
    E2E_USER.email,
  );
  await page.getByRole("button", { name: "Ajouter un participant" }).click();
  await main(page).getByLabel("Prénom du participant 2").fill("Léa");
  await main(page).getByLabel("Email du compte du participant 2").fill("personne@test.local");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(main(page).getByRole("alert")).toHaveText(
    "Aucun compte avec cet email : il faut un compte existant.",
  );
  await main(page).getByLabel("Email du compte du participant 2").fill(E2E_MEMBER.email);
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Léa sees the trip, shared by its owner, and adds an expense.
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

  // She cannot change accounts nor delete the trip, but can leave it.
  await main(member).getByRole("link", { name: "Modifier" }).click();
  await expect(main(member).getByLabel("Email du compte du participant 2")).toHaveAttribute(
    "readonly",
  );
  await expect(main(member).getByRole("button", { name: "Supprimer le voyage" })).toHaveCount(0);
  await main(member).getByRole("button", { name: "Quitter le voyage" }).click();
  await member.getByRole("button", { name: "Quitter", exact: true }).click();
  await expect(toasts(member).getByText("Tu as quitté le voyage")).toBeVisible();
  await expect(main(member).getByRole("link").filter({ hasText: name })).toHaveCount(0);
  await memberContext.close();

  // The owner sees her expense; she is still a participant, without account.
  await page.reload();
  await expect(page.getByTestId("trip-total")).toHaveText("8,00 €");
  await expect(page.getByRole("link", { name: /Takoyaki/ })).toBeVisible();
  await main(page).getByRole("link", { name: "Modifier" }).click();
  await expect(main(page).getByLabel("Prénom du participant 2")).toHaveValue("Léa");
  await expect(main(page).getByLabel("Email du compte du participant 2")).toHaveValue("");

  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});
