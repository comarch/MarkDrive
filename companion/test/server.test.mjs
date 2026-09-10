import { test } from "node:test";
import assert from "node:assert/strict";
import { createCompanion } from "../src/server.mjs";

const listen = (companion) =>
  new Promise((resolve) => {
    companion.server.listen(0, () => {
      resolve(companion.server.address().port);
    });
  });

const post = async (port, path, body, headers = {}) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
};

test("health reports capabilities, all off without configuration", async () => {
  const companion = createCompanion({
    driveWebhookSecret: "",
    publicUrl: "",
    geminiApiKey: "",
    slackWebhookUrl: "",
  });
  const port = await listen(companion);
  const response = await fetch(`http://127.0.0.1:${port}/healthz`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.capabilities.relay, true);
  assert.equal(body.capabilities.driveWatch, false);
  assert.equal(body.capabilities.aiProxy, false);
  assert.equal(body.capabilities.integrations, false);
  await companion.close();
});

test("unconfigured capabilities return 503, not crashes", async () => {
  const companion = createCompanion({});
  const port = await listen(companion);
  const ai = await post(port, "/v1/ai/generate", { contents: [] });
  assert.equal(ai.status, 503);
  const watch = await post(port, "/v1/drive/watch", { fileId: "f", accessToken: "t" });
  assert.equal(watch.status, 503);
  const notify = await post(port, "/v1/integrations/notify", { event: "x" });
  assert.equal(notify.status, 503);
  await companion.close();
});

test("drive notify rejects unknown webhook tokens and records it", async () => {
  const companion = createCompanion({ DRIVE_WEBHOOK_SECRET: "s3cret", PUBLIC_URL: "https://companion.invalid" });
  const port = await listen(companion);
  const rejected = await post(port, "/v1/drive/notify", {}, {
    "x-goog-channel-token": "wrong",
    "x-goog-channel-id": "ch-1",
  });
  assert.equal(rejected.status, 403);
  const stats = await (await fetch(`http://127.0.0.1:${port}/v1/audit/stats`)).json();
  assert.equal(stats.byEvent["drive.notify.rejected"], 1);
  await companion.close();
});

test("search indexes documents and returns ranked AND results", async () => {
  const companion = createCompanion({});
  const port = await listen(companion);
  await post(port, "/v1/search/index", {
    fileId: "f1",
    name: "Runbook Cache",
    content: "the cache warms on boot and flushes on save",
  });
  await post(port, "/v1/search/index", {
    fileId: "f2",
    name: "RFC Search",
    content: "search ranks documents by term frequency",
  });
  const hit = await (await fetch(`http://127.0.0.1:${port}/v1/search?q=cache%20warms`)).json();
  assert.equal(hit.results.length, 1);
  assert.equal(hit.results[0].fileId, "f1");
  // AND semantics: a term missing from every document returns nothing.
  const miss = await (await fetch(`http://127.0.0.1:${port}/v1/search?q=cache%20database`)).json();
  assert.equal(miss.results.length, 0);
  // Name matches rank first via the boost.
  const name = await (await fetch(`http://127.0.0.1:${port}/v1/search?q=search`)).json();
  assert.equal(name.results[0].fileId, "f2");
  await companion.close();
});

test("audit export returns JSONL entries honoring the since filter", async () => {
  const companion = createCompanion({});
  const port = await listen(companion);
  await post(port, "/v1/search/index", { fileId: "f1", name: "n", content: "c" });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await post(port, "/v1/search/index", { fileId: "f2", name: "n", content: "c" });
  const all = await (await fetch(`http://127.0.0.1:${port}/v1/audit/export`)).text();
  const lines = all.trim().split("\n").filter(Boolean);
  assert.ok(lines.length >= 2);
  const entries = lines.map((line) => JSON.parse(line));
  for (const entry of entries) assert.doesNotThrow(() => JSON.stringify(entry));
  // Filtering from the newest entry's own timestamp returns exactly
  // that entry, deterministically.
  const last = entries[entries.length - 1];
  const later = await (
    await fetch(`http://127.0.0.1:${port}/v1/audit/export?since=${encodeURIComponent(last.timestamp)}`)
  ).text();
  const laterLines = later.trim().split("\n").filter(Boolean);
  assert.equal(laterLines.length, 1);
  await companion.close();
});

test("ai proxy forwards the generateContent contract and key stays hidden", async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    // Only the outbound Gemini call is stubbed; the test's own requests
    // to the local server pass through.
    if (!target.startsWith("https://generativelanguage.googleapis.com/")) {
      return realFetch(url, init);
    }
    seen.push({ url: target, body: JSON.parse(init.body) });
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
      { status: 200 },
    );
  };
  try {
    const companion = createCompanion({ GEMINI_API_KEY: "server-key", GEMINI_MODEL: "gemini-test" });
    const port = await listen(companion);
    const result = await post(port, "/v1/ai/generate", {
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
    });
    assert.equal(result.status, 200);
    assert.equal(result.json.candidates[0].content.parts[0].text, "ok");
    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /models\/gemini-test:generateContent\?key=server-key$/);
    assert.deepEqual(seen[0].body.contents, [{ role: "user", parts: [{ text: "hi" }] }]);
    await companion.close();
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("ai proxy rejects bodies without contents", async () => {
  const companion = createCompanion({ GEMINI_API_KEY: "k" });
  const port = await listen(companion);
  const bad = await post(port, "/v1/ai/generate", { nope: true });
  assert.equal(bad.status, 400);
  await companion.close();
});
