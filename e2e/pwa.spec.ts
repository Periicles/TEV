import { expect, signIn, test } from "./fixtures";

test("can be installed: manifest and icons are public", async ({ page, request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ short_name: "TEV", start_url: "/", display: "standalone" });
  for (const icon of manifest.icons as { src: string }[]) {
    const image = await request.get(icon.src);
    expect(image.ok(), icon.src).toBe(true);
    expect(image.headers()["content-type"]).toBe("image/png");
  }

  // Signed out, the login page still links them.
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(appleIcon!)).ok()).toBe(true);
});

test("shows an offline page when the network is down, then comes back", async ({
  page,
  context,
}) => {
  await signIn(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // The worker controls pages loaded after it activated.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pas de connexion" })).toBeVisible();

  // Back online, the page reloads by itself.
  await context.setOffline(false);
  await expect(page.getByRole("heading", { name: "Mes voyages" })).toBeVisible();
});
