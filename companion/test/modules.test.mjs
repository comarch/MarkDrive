import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { createSearchIndex } from "../src/search.mjs";
import { createAuditLog } from "../src/audit.mjs";
import { createAiProxy } from "../src/ai-proxy.mjs";
import { createNotifier } from "../src/integrations.mjs";

const SEARCH_PATH = "./.tmp-search-index.jsonl";
const AUDIT_PATH = "./.tmp-audit.jsonl";

test("search ranking: term frequency with a name boost", () => {
  rmSync(SEARCH_PATH, { force: true });
  const index = createSearchIndex(SEARCH_PATH);
  index.index("a", {
    name: "Plain",
    content: "engine engine engine engine engine engine engine engine basics",
  });
  index.index("b", { name: "Engine Guide", content: "engine basics" });
  const results = index.query("engine");
  // Eight body hits beat one body hit plus the name boost.
  assert.equal(results[0].fileId, "a");
  const named = index.query("guide");
  assert.equal(named[0].fileId, "b");
});

test("search persistence round-trips through JSONL", () => {
  rmSync(SEARCH_PATH, { force: true });
  const first = createSearchIndex(SEARCH_PATH);
  first.index("f1", { name: "Persisted", content: "durable content here" });
  const second = createSearchIndex(SEARCH_PATH);
  assert.equal(second.size(), 1);
  assert.equal(second.query("durable")[0].fileId, "f1");
});

test("audit retention prunes entries past the window", () => {
  rmSync(AUDIT_PATH, { force: true });
  // A two-day-old entry under one-day retention is deterministically
  // past the window; a fresh entry survives it.
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  writeFileSync(
    AUDIT_PATH,
    JSON.stringify({ timestamp: old, event: "old.event" }) + "\n",
  );
  const reader = createAuditLog(AUDIT_PATH, 1);
  assert.equal(reader.stats().count, 0);
  reader.record("fresh.event", { fileId: "f" });
  assert.equal(reader.stats().count, 1);
});

test("audit log persists entries to JSONL", () => {
  rmSync(AUDIT_PATH, { force: true });
  const first = createAuditLog(AUDIT_PATH, 365);
  first.record("search.indexed", { fileId: "f1" });
  const second = createAuditLog(AUDIT_PATH, 365);
  assert.equal(second.stats().byEvent["search.indexed"], 1);
});

test("ai proxy hides the key from callers and surfaces failures", async () => {
  const calls = [];
  const proxy = createAiProxy("hidden-key", "m1", async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1) {
      return new Response("{}", { status: 429 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  assert.equal(proxy.isEnabled(), true);
  const limited = await proxy.generate({ contents: [] });
  assert.equal(limited.ok, false);
  assert.equal(limited.status, 429);
  const fine = await proxy.generate({ contents: [{ parts: [{ text: "q" }] }] });
  assert.equal(fine.ok, true);
  assert.match(calls[1].url, /key=hidden-key/);
  const disabled = createAiProxy("");
  assert.equal(disabled.isEnabled(), false);
  assert.equal((await disabled.generate({ contents: [] })).ok, false);
});

test("notifier delivers to slack and records outcomes", async () => {
  const delivered = [];
  const audit = createAuditLog("");
  const notifier = createNotifier(
    "https://slack.invalid/hook",
    audit,
    async (url, init) => {
      delivered.push({ url, body: JSON.parse(init.body) });
      return new Response("ok", { status: delivered.length === 1 ? 200 : 500 });
    },
  );
  assert.equal(
    await notifier.notify({
      event: "review.comment",
      fileId: "f",
      text: "hello",
    }),
    true,
  );
  assert.equal(
    await notifier.notify({
      event: "review.comment",
      fileId: "f",
      text: "hello",
    }),
    false,
  );
  assert.deepEqual(delivered[0].body, { text: "hello" });
  assert.equal(audit.stats().byEvent["integrations.delivered"], 1);
  assert.equal(audit.stats().byEvent["integrations.failed"], 1);
});
