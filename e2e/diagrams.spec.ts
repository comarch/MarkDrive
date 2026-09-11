import { expect, test } from "@playwright/test";

test.describe("diagrams and math depth", () => {
  test("renders graphviz diagrams and equation numbers", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "gdrive_md_last_content",
        [
          "---",
          "math-macros:",
          '  CC: "\\\\mathbb{C}"',
          "---",
          "",
          "# Diagrams",
          "",
          "```dot",
          "digraph { roll -> out }",
          "```",
          "",
          "Math with a macro:",
          "",
          "$$z \\in \\CC$$",
        ].join("\n"),
      );
    });
    await page.goto("/");

    // The Graphviz engine loads lazily and renders an inline SVG.
    const rendered = page.locator(".graphviz-rendered svg");
    await expect(rendered.first()).toBeVisible({ timeout: 15000 });

    // Display math carries a running equation number.
    await expect(page.locator(".equation-number").first()).toHaveText("(1)");
  });
});
