import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AIActionContext,
  AICommandId,
  AISettings,
  availableCommands,
  defaultAISettings,
} from "../services/ai";

// Fetch call captures, typed loosely because the mock signature is
// structural.
const fetchCalls = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls as unknown as Array<[string, RequestInit]>;

const baseContext: AIActionContext = {
  document: "# Doc\n\nSome text about **engines**.",
  selection: null,
  commentThreads: [],
  previousRevision: null,
};

const enabledSettings = (overrides: Partial<AISettings> = {}): AISettings => ({
  ...defaultAISettings(),
  enabled: true,
  apiKey: "test-key",
  ...overrides,
});

const geminiResponse = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] } }],
});

const successfulFetch = vi.fn(
  async () =>
    new Response(JSON.stringify(geminiResponse("**shortened**")), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
);

describe("AI assistant service", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    successfulFetch.mockClear();
  });

  it("is disabled when the build flag is off", async () => {
    vi.stubEnv("VITE_ENABLE_AI", "");
    vi.resetModules();
    const { runAICommand: gated } = await import("../services/ai");
    const result = await gated(
      enabledSettings(),
      { command: "shorten" },
      baseContext,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("compiled out");
  });

  it("refuses to run when disabled or unconfigured", async () => {
    vi.stubEnv("VITE_ENABLE_AI", "1");
    vi.resetModules();
    const { runAICommand: run } = await import("../services/ai");

    const disabled = await run(
      defaultAISettings(),
      { command: "shorten" },
      baseContext,
    );
    expect(disabled.ok).toBe(false);
    expect(disabled.error).toContain("off");

    const unconfigured = await run(
      enabledSettings({ apiKey: "" }),
      { command: "shorten" },
      baseContext,
    );
    expect(unconfigured.ok).toBe(false);
    expect(unconfigured.error).toContain("missing");
  });

  it("targets the model endpoint with the key and prompt", async () => {
    vi.stubEnv("VITE_ENABLE_AI", "1");
    vi.resetModules();
    const { runAICommand: run } = await import("../services/ai");
    vi.stubGlobal("fetch", successfulFetch);

    const result = await run(
      enabledSettings({ model: "gemini-test" }),
      { command: "shorten" },
      { ...baseContext, selection: "very long paragraph" },
    );

    expect(result.ok).toBe(true);
    expect(result.text).toBe("**shortened**");
    const [url, init] = fetchCalls(successfulFetch)[0]!;
    expect(url).toContain(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent",
    );
    expect(url).toContain("key=test-key");
    const body = JSON.parse(init.body as string) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    expect(body.contents[0]?.parts[0]?.text).toContain("very long paragraph");
  });

  it("uses the configured endpoint for firebase and companion modes", async () => {
    vi.stubEnv("VITE_ENABLE_AI", "1");
    vi.resetModules();
    const { runAICommand: run } = await import("../services/ai");
    vi.stubGlobal("fetch", successfulFetch);

    await run(
      enabledSettings({
        mode: "firebase",
        apiKey: "",
        firebaseEndpoint: "https://proxy.invalid/ai",
      }),
      { command: "summarizeDoc" },
      baseContext,
    );
    expect(fetchCalls(successfulFetch)[0]?.[0]).toBe(
      "https://proxy.invalid/ai",
    );

    await run(
      enabledSettings({
        mode: "companion",
        apiKey: "",
        companionBaseUrl: "https://companion.invalid/",
      }),
      { command: "summarizeDoc" },
      baseContext,
    );
    expect(fetchCalls(successfulFetch)[1]?.[0]).toBe(
      "https://companion.invalid/v1/ai/generate",
    );
  });

  it("reports endpoint failures without throwing", async () => {
    vi.stubEnv("VITE_ENABLE_AI", "1");
    vi.resetModules();
    const { runAICommand: run } = await import("../services/ai");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 429 })),
    );
    const limited = await run(
      enabledSettings(),
      { command: "grammar" },
      {
        ...baseContext,
        selection: "txt",
      },
    );
    expect(limited.ok).toBe(false);
    expect(limited.error).toContain("429");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const unreachable = await run(
      enabledSettings(),
      { command: "grammar" },
      {
        ...baseContext,
        selection: "txt",
      },
    );
    expect(unreachable.ok).toBe(false);
    expect(unreachable.error).toContain("reached");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );
    const empty = await run(
      enabledSettings(),
      { command: "grammar" },
      {
        ...baseContext,
        selection: "txt",
      },
    );
    expect(empty.ok).toBe(false);
    expect(empty.error).toContain("empty");
  });

  it("declines commands without material to work on", async () => {
    vi.stubEnv("VITE_ENABLE_AI", "1");
    vi.resetModules();
    const { runAICommand: run } = await import("../services/ai");
    vi.stubGlobal("fetch", successfulFetch);

    const noDraftTopic = await run(
      enabledSettings(),
      { command: "draft" },
      baseContext,
    );
    expect(noDraftTopic.ok).toBe(false);
    expect(noDraftTopic.error).toContain("nothing");

    const emptyDoc = await run(
      enabledSettings(),
      { command: "summarizeDoc" },
      { ...baseContext, document: "" },
    );
    expect(emptyDoc.ok).toBe(false);

    const noRevision = await run(
      enabledSettings(),
      { command: "changelog" },
      baseContext,
    );
    expect(noRevision.ok).toBe(false);
  });

  it("translates Polish text to English and English to Polish", async () => {
    vi.stubEnv("VITE_ENABLE_AI", "1");
    vi.resetModules();
    const { runAICommand: run } = await import("../services/ai");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(String(init.body));
        return new Response(JSON.stringify(geminiResponse("ok")), {
          status: 200,
        });
      }),
    );

    await run(
      enabledSettings(),
      { command: "translate" },
      {
        ...baseContext,
        selection: "Zażółć gęślą jaźń",
      },
    );
    expect(calls[0]).toContain("Polish to English");

    await run(
      enabledSettings(),
      { command: "translate" },
      {
        ...baseContext,
        selection: "The quick brown fox",
      },
    );
    expect(calls[1]).toContain("English to Polish");
  });

  it("lists commands matching the available material", () => {
    const commands = availableCommands(baseContext);
    expect(commands).toContain("summarizeDoc");
    expect(commands).toContain("draft");
    expect(commands).not.toContain("commentToPatch");
    expect(commands).not.toContain("changelog");

    const withSelection = availableCommands({
      ...baseContext,
      selection: "picked text",
      commentThreads: ["please reword this"],
      previousRevision: "# old",
    });
    expect(withSelection).toContain("commentToPatch");
    expect(withSelection).toContain("changelog");
    expect(withSelection).toContain("summarizeThread");
    const ids: AICommandId[] = ["commentToPatch"];
    expect(ids).toHaveLength(1);
  });
});
