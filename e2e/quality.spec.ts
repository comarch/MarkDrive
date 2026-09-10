import { expect, test } from "@playwright/test";

test.describe("authoring quality checks", () => {
  test("shows inline diagnostics for style problems", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "gdrive_md_last_content",
        ["# Quality", "", "### Deep jump", "", "text with trail ", ""].join(
          "\n",
        ),
      );
    });
    await page.goto("/");

    // The linter marks the offending lines in the editor gutter.
    await expect(page.locator(".cm-lintRange").first()).toBeVisible({
      timeout: 8000,
    });

    // Hovering a marked line opens the diagnostic tooltip.
    await page.locator(".cm-lintRange").first().hover();
    await expect(page.locator(".cm-diagnosticText").first()).toBeVisible();
  });
});
