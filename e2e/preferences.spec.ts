import { expect, test } from "./fixtures";

test.describe("on an English device", () => {
  test.use({ locale: "en-GB" });

  test("follows the device language and region", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in", { exact: true }).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-GB");
  });
});

test.describe("on a Japanese device", () => {
  test.use({ locale: "ja-JP" });

  test("falls back to French", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Connexion", { exact: true })).toBeVisible();
  });
});

test.describe("in dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("follows the system theme", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test("keeps the language and theme chosen in the menu", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Préférences" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.getByText("Sign in", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Preferences" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.getByText("Sign in", { exact: true }).first()).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
