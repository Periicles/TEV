import type { Page } from "@playwright/test";
import { E2E_USER, expect, test } from "./fixtures";

async function signIn(page: Page, password = E2E_USER.password) {
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("sends visitors to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Connexion", { exact: true })).toBeVisible();
});

test("rejects a wrong password", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, "not-the-password");
  await expect(page.locator("form [role=alert]")).toHaveText("Email ou mot de passe incorrect.");
  await expect(page).toHaveURL(/\/login$/);
});

test("signs in and out", async ({ page }) => {
  await page.goto("/login");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();

  await page.getByRole("button", { name: "Préférences" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("blocks sign-in after too many attempts", async ({ page }) => {
  await page.goto("/login");
  const alert = page.locator("form [role=alert]");
  for (let attempt = 1; attempt <= 6; attempt++) {
    await signIn(page, `wrong-password-${attempt}`);
    await expect(alert).toBeVisible();
  }
  await expect(alert).toHaveText("Trop de tentatives. Réessaie dans une minute.");

  // Even the right password is refused until the window ends.
  await signIn(page);
  await expect(alert).toHaveText("Trop de tentatives. Réessaie dans une minute.");
});
