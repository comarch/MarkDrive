import { describe, expect, it, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { applyContentToText } from "../services/collab";
import {
  indexForSearch,
  notifyIntegration,
  openEventStream,
  registerDriveWatch,
  searchCompanion,
} from "../services/companion";

describe("collab text binding", () => {
  it("is a no-op when the content matches", () => {
    const doc = new Y.Doc();
    const text = doc.getText("content");
    text.insert(0, "same text");
    applyContentToText(text, "same text");
    expect(text.toString()).toBe("same text");
  });

  it("splices only the changed middle", () => {
    const doc = new Y.Doc();
    const text = doc.getText("content");
    text.insert(0, "The quick brown fox");
    applyContentToText(text, "The slow brown fox");
    expect(text.toString()).toBe("The slow brown fox");
  });

  it("appends and truncates at the edges", () => {
    const doc = new Y.Doc();
    const text = doc.getText("content");
    text.insert(0, "abc");
    applyContentToText(text, "abcdef");
    expect(text.toString()).toBe("abcdef");
    applyContentToText(text, "ab");
    expect(text.toString()).toBe("ab");
    applyContentToText(text, "");
    expect(text.toString()).toBe("");
  });

  it("converges when one session edits and the other syncs", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const textA = a.getText("content");
    const textB = b.getText("content");
    textA.insert(0, "shared base");
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    // Only one side applies the change; the other receives it.
    applyContentToText(textA, "shared base, edited");
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    expect(textA.toString()).toBe("shared base, edited");
    expect(textB.toString()).toBe("shared base, edited");
  });

  it("merges concurrent edits without losing either", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const textA = a.getText("content");
    const textB = b.getText("content");
    textA.insert(0, "base");
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    applyContentToText(textA, "base from A");
    applyContentToText(textB, "B said base");
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    expect(textA.toString()).toBe(textB.toString());
    expect(textA.toString()).toContain("base");
  });
});

describe("companion client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the right payloads and parses responses", async () => {
    const calls: Array<[string, RequestInit]> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push([String(url), init]);
        if (String(url).includes("/v1/search?")) {
          return new Response(
            JSON.stringify({
              query: "q",
              results: [{ fileId: "f1", name: "N", score: 3, snippet: "s" }],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    await registerDriveWatch("http://companion.invalid/", "f1", "tok");
    expect(calls[0]?.[0]).toBe("http://companion.invalid/v1/drive/watch");
    expect(JSON.parse(String(calls[0]?.[1].body))).toEqual({
      fileId: "f1",
      accessToken: "tok",
    });

    await indexForSearch("http://companion.invalid", {
      fileId: "f1",
      name: "Doc",
      content: "body",
    });
    expect(calls[1]?.[0]).toBe("http://companion.invalid/v1/search/index");

    const hits = await searchCompanion("http://companion.invalid", "q");
    expect(hits?.results[0]?.fileId).toBe("f1");

    await notifyIntegration("http://companion.invalid", {
      event: "review.comment",
      fileId: "f1",
      text: "hello",
    });
    expect(calls[3]?.[0]).toBe(
      "http://companion.invalid/v1/integrations/notify",
    );
  });

  it("returns null instead of throwing on failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );
    expect(await searchCompanion("http://companion.invalid", "q")).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    expect(
      await notifyIntegration("http://companion.invalid", {
        event: "e",
        text: "t",
      }),
    ).toBeNull();
    expect(
      await registerDriveWatch("http://companion.invalid", "f", "t"),
    ).toBeNull();
  });

  it("opens an event stream only with WebSocket support", () => {
    const stream = openEventStream("http://companion.invalid", "f1", () => {});
    if (typeof WebSocket === "undefined") {
      expect(stream).toBeNull();
    } else {
      expect(typeof stream?.close).toBe("function");
      stream?.close();
    }
  });
});
