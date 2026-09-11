import { expect, test } from "@playwright/test";

test.describe("reach: language and mobile layout", () => {
  test("switches the interface to Polish", async ({ page }) => {
    await page.goto("/");

    await page.getByTitle("Settings & Google OAuth Config").click();
    await page.getByLabel("Interface Language").selectOption("pl");
    await page.getByRole("button", { name: "Save Settings" }).click();

    // The shell now speaks Polish.
    await expect(
      page.getByTitle("Zapisz na Google Drive (Ctrl + S)"),
    ).toBeVisible();
    await expect(page.getByTitle("Historia wersji")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sugestie" })).toBeVisible();
  });

  test("uses a single pane with a switch on phones", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto("/");

    // Only the editor shows on a phone in split mode.
    await expect(page.locator(".cm-content")).toBeVisible();
    await expect(page.locator(".preview-container")).toHaveCount(0);

    // The floating switch reveals the preview.
    const toggle = page
      .getByTitle("Przełącz na podgląd")
      .or(page.getByTitle("Switch to preview"));
    await toggle.click();
    await expect(page.locator(".preview-container")).toBeVisible();
    await expect(page.locator(".cm-content")).toHaveCount(0);
  });
});
