import type { Page } from "@playwright/test";
import { E2E_MEMBER, expect, signIn, test } from "./fixtures";

/** The visible page: Next keeps visited pages hidden in the DOM. */
const main = (page: Page) => page.getByRole("main");

test("tells about shared trips and expenses added by others", async ({
  page,
  browser,
}, testInfo) => {
  // Opening the notifications reads all of the account's notifications: two runs of this test at
  // once with the same accounts would read each other's. One screen size is enough here.
  test.skip(testInfo.project.name !== "desktop", "Runs once, on desktop.");
  const name = `Notif ${testInfo.project.name} ${Date.now()}`;

  // The owner shares a new trip with Léa.
  await signIn(page);
  await page.getByRole("link", { name: "Nouveau voyage" }).click();
  await main(page).getByLabel("Nom", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Ajouter un participant" }).click();
  await main(page).getByLabel("Prénom du participant 2").fill("Léa");
  await main(page).getByLabel("Email du compte du participant 2").fill(E2E_MEMBER.email);
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Léa sees it in her notifications and in her trips list.
  const memberContext = await browser.newContext({
    ...testInfo.project.use,
    extraHTTPHeaders: { "x-real-ip": `10.253.${testInfo.workerIndex}.${testInfo.repeatEachIndex}` },
  });
  const member = await memberContext.newPage();
  await signIn(member, E2E_MEMBER);
  const card = main(member).getByRole("link").filter({ hasText: name });
  await expect(card.getByTestId("news")).toHaveText("Nouveau");
  await expect(member.getByTestId("unread-count")).toBeVisible();
  await member.getByRole("link", { name: /^Notifications/ }).click();
  const shared = main(member).getByTestId("notification").filter({ hasText: name });
  await expect(shared).toHaveText(new RegExp(`E2E a partagé « ${name} » avec toi`));

  // She adds two expenses from the notification's trip.
  await shared.click();
  for (const label of ["Takoyaki", "Okonomiyaki"]) {
    await member.getByRole("link", { name: "Ajouter une dépense" }).click();
    await main(member).getByLabel("Devise", { exact: true }).selectOption("EUR");
    await main(member).getByLabel("Montant", { exact: true }).fill("8");
    await main(member).getByLabel("Libellé", { exact: true }).fill(label);
    await member.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(member.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }
  await memberContext.close();

  // The owner gets one notification for both, and the trip is marked new until opened.
  await page.goto("/");
  const ownerCard = main(page).getByRole("link").filter({ hasText: name });
  await expect(ownerCard.getByTestId("news")).toBeVisible();
  await page.goto("/notifications");
  await expect(main(page).getByTestId("notification").filter({ hasText: name })).toHaveText(
    new RegExp(`Léa a ajouté 2 dépenses à « ${name} »`),
  );
  await page.goto("/");
  await ownerCard.click();
  await expect(page.getByTestId("trip-total")).toHaveText("16,00 €");
  await page.goto("/");
  await expect(ownerCard.getByTestId("news")).toHaveCount(0);

  await ownerCard.click();
  await main(page).getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("button", { name: "Supprimer le voyage" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});
