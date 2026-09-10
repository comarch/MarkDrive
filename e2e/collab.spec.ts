import { expect, test } from "@playwright/test";

// Roadmap items 27-29: two authors edit one document through the
// companion relay without conflict dialogs, presence is visible, and
// the organization search index answers queries.

const COMPANION = "http://localhost:8899";

test.describe("collaborative editing", () => {
  test("two authors converge on one document with presence", async ({
    browser,
  }) => {
    // One context: both pages share the demo-mode mock Drive storage,
    // so they open the same file and the same relay room.
    const context = await browser.newContext();
    const alice = await context.newPage();
    const bob = await context.newPage();

    for (const page of [alice, bob]) {
      await page.addInitScript(() => {
        localStorage.setItem(
          "gdrive_md_settings",
          JSON.stringify({ companionUrl: "http://localhost:8899" }),
        );
      });
    }

    await alice.goto("/");
    await bob.goto("/");

    // Alice creates a Drive file (demo mode mock storage is shared).
    await alice.getByTitle("New document (Create in Drive)").click();
    await expect(alice.locator(".cm-content")).toBeVisible();
    await alice.getByTitle("Click to rename document").click();
    await alice
      .getByPlaceholder("")
      .or(alice.locator('input[type="text"]').first())
      .fill("Collab Notes.md");
    await alice.keyboard.press("Enter");

    // Bob opens the same file from the browser.
    await bob.getByTitle("Open Markdown files").click();
    const fileButton = bob
      .locator("button")
      .filter({ hasText: "Collab Notes.md" })
      .first();
    await expect(fileButton).toBeVisible({ timeout: 15_000 });
    await fileButton.click();
    await expect(bob.locator(".cm-content")).toBeVisible();

    // Alice types; the relay carries it to Bob without a reload.
    await alice.locator(".cm-content").click();
    await alice.keyboard.press("ControlOrMeta+End");
    await alice.keyboard.type("\ntyped by alice");

    await expect(bob.locator(".cm-content")).toContainText("typed by alice", {
      timeout: 15_000,
    });

    // Bob types back; Alice sees it too.
    await bob.locator(".cm-content").click();
    await bob.keyboard.press("ControlOrMeta+End");
    await bob.keyboard.type("\ntyped by bob");
    await expect(alice.locator(".cm-content")).toContainText("typed by bob", {
      timeout: 15_000,
    });

    // Presence: both headers show the other author.
    await expect(bob.locator('span[title="Guest author"]').first()).toBeVisible(
      {
        timeout: 15_000,
      },
    );

    await context.close();
  });

  test("saves feed the organization search index", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem(
        "gdrive_md_settings",
        JSON.stringify({ companionUrl: "http://localhost:8899" }),
      );
    });
    await page.goto("/");

    await page.getByTitle("New document (Create in Drive)").click();
    await page.locator(".cm-content").click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      "# Searchable Doc\n\nunique needle term for the organization index\n",
    );

    // Saving pushes the document into the companion index.
    await page.getByTitle("Save to Google Drive (Ctrl + S)").click();
    await expect(page.getByText("Saved").first()).toBeVisible({
      timeout: 15_000,
    });

    // The index answers a query for the unique term.
    await page.getByTitle("Open Markdown files").click();
    await page.getByLabel("Search the organization index").fill("needle");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("unique needle term").first()).toBeVisible({
      timeout: 15_000,
    });

    await context.close();
  });

  test("the companion stays optional", async ({ page }) => {
    // Without a configured companion the app works exactly as before.
    await page.goto("/");
    await expect(page.locator(".cm-content")).toBeVisible();
    await expect(
      page.getByText("The organization index is not reachable"),
    ).toHaveCount(0);
  });

  test("health reports capabilities", async ({ request }) => {
    const response = await request.get(`${COMPANION}/healthz`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.capabilities.relay).toBe(true);
    expect(body.capabilities.search).toBe(true);
  });
});
