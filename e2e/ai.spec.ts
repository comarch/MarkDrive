import { expect, test } from "@playwright/test";

// Roadmap item 26: the feature-flagged AI assistant stays off by default
// and, once enabled, sends prompts to the configured endpoint only.

test.describe("AI assistant", () => {
  test("stays off by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTitle("AI assistant")).toHaveCount(0);
  });

  test("runs a command through the configured endpoint", async ({ page }) => {
    // The assistant is enabled with a fake key in browser storage.
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "gdrive_md_settings",
        JSON.stringify({
          ai: {
            enabled: true,
            mode: "apiKey",
            apiKey: "e2e-key",
            model: "gemini-e2e",
          },
        }),
      );
    });
    await page.reload();

    await page.getByTitle("AI assistant").click();
    await expect(
      page.getByRole("heading", { name: "AI Assistant" }),
    ).toBeVisible();
    // The privacy notice is part of the contract, not decoration.
    await expect(
      page.getByText("Whatever you run is sent to the configured AI provider"),
    ).toBeVisible();

    // The endpoint is mocked; the key and model must match the settings.
    await page.route(
      "**/v1beta/models/gemini-e2e:generateContent*",
      async (route) => {
        const url = route.request().url();
        expect(url).toContain("key=e2e-key");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            candidates: [
              { content: { parts: [{ text: "- E2E summary point" }] } },
            ],
          }),
        });
      },
    );

    await page.getByLabel("Command").selectOption("summarizeDoc");
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByTestId("ai-panel").locator("pre")).toContainText(
      "E2E summary point",
    );

    // The result lands in the document at the cursor.
    await page.getByRole("button", { name: "Insert at cursor" }).click();
    await expect(page.locator(".cm-content")).toContainText(
      "E2E summary point",
    );
    await expect(page.locator(".preview-container")).toContainText(
      "E2E summary point",
    );
  });

  test("surfaces endpoint failures without crashing", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "gdrive_md_settings",
        JSON.stringify({
          ai: { enabled: true, mode: "apiKey", apiKey: "e2e-key" },
        }),
      );
    });
    await page.reload();

    await page.route("**/v1beta/**:generateContent*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "no",
      });
    });

    await page.getByTitle("AI assistant").click();
    await page.getByLabel("Command").selectOption("summarizeDoc");
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByRole("alert")).toContainText("500");
  });
});
