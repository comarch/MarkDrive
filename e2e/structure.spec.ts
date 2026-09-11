import { expect, test } from "@playwright/test";

test.describe("structure tools", () => {
  test("moves sections, numbers headings, and inserts a TOC", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "gdrive_md_last_content",
        [
          "# Guide",
          "",
          "## Alpha",
          "",
          "alpha body",
          "",
          "## Beta",
          "",
          "beta body",
          "",
          "## Gamma",
          "",
          "gamma body",
          "",
        ].join("\n"),
      );
    });
    await page.goto("/");
    await expect(page.locator(".cm-content")).toContainText("alpha body");

    const editor = page.locator(".cm-content");

    // Open the outline and move the Alpha section down.
    await page.getByTitle("Toggle document outline").click();
    await page.getByRole("button", { name: "Move section Alpha down" }).click();
    await expect(editor).toContainText("beta body");
    const text = await editor.innerText();
    expect(text.indexOf("beta body")).toBeLessThan(text.indexOf("alpha body"));

    // The TOC insertion links the current sections.
    await page.getByTitle("Insert a table of contents").click();
    await expect(editor).toContainText("- [Beta](#beta)");
    await expect(editor).toContainText("- [Alpha](#alpha)");

    // Heading numbering adds sequential numbers.
    await page.getByTitle("Number level 2+ headings").click();
    await expect(editor).toContainText("## 1. Beta");
    await expect(editor).toContainText("## 2. Alpha");
  });
});
