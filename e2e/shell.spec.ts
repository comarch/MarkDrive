import { expect, test } from "@playwright/test";

test.describe("material shell", () => {
  test("zoom controls resize editor and preview text", async ({ page }) => {
    await page.goto("/");

    const zoomOut = page.getByRole("button", { name: "Zoom out" });
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    const indicator = page.getByRole("toolbar", { name: "Zoom" });

    await expect(indicator).toContainText("14px");

    await zoomIn.click();
    await expect(indicator).toContainText("15px");
    await expect
      .poll(async () =>
        page
          .locator(".cm-content")
          .evaluate((el) => getComputedStyle(el).fontSize),
      )
      .toBe("15px");

    await zoomOut.click();
    await zoomOut.click();
    await expect(indicator).toContainText("13px");

    // The mode switch keeps its segmented control semantics.
    await expect(page.getByRole("button", { name: "Suggest" })).toBeVisible();
    await page.getByRole("button", { name: "Suggest" }).click();
    await expect(page.getByText("Suggesting.")).toBeVisible();
  });
});
