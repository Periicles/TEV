import { expect, signIn, test } from "./fixtures";

test("explains a missing trip or page in the app's language", async ({ page }) => {
  await signIn(page);

  for (const path of ["/trips/00000000-0000-4000-8000-000000000000", "/nothing-here"]) {
    // Pages stream, so a trip found missing mid-stream keeps a 200 status: check the content.
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  }

  await page.getByRole("link", { name: "Retour à mes voyages" }).click();
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});
