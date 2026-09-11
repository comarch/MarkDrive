import { expect, test } from "@playwright/test";

test.describe("presentation mode", () => {
  test("presents slides and navigates with the keyboard", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "gdrive_md_last_content",
        [
          "# Slide one",
          "",
          "First content",
          "",
          "---",
          "",
          "## Slide two",
          "",
          "Second content",
          "",
          "---",
          "",
          "# Slide three",
          "",
          "Final content",
        ].join("\n"),
      );
    });
    await page.goto("/");

    await page.getByTitle("Present as slides").click();
    const stage = page.locator(".slide-stage");
    await expect(stage).toContainText("Slide one");
    await expect(page.getByText("1 / 3")).toBeVisible();

    // Arrow keys advance and go back.
    await page.keyboard.press("ArrowRight");
    await expect(stage).toContainText("Slide two");
    await expect(page.getByText("2 / 3")).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(stage).toContainText("Slide three");

    await page.keyboard.press("ArrowLeft");
    await expect(stage).toContainText("Slide two");

    // The agenda jumps to a chosen slide.
    await page.getByTitle("Slide agenda (G)").click();
    await page.getByText("3. Slide three").click();
    await expect(stage).toContainText("Slide three");

    // Escape exits presentation mode.
    await page.keyboard.press("Escape");
    await expect(page.getByTitle("Present as slides")).toBeVisible();
    await expect(page.locator(".cm-content")).toContainText("Slide one");
  });
});
