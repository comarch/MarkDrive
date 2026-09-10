import { describe, expect, it } from "vitest";
import {
  applySuggestionHunks,
  buildSuggestionHunks,
  parseSuggestions,
  serializeSuggestions,
  SUGGESTION_MARKER,
} from "../utils/patch";

const BASE = `# Title

Intro paragraph.

## Section

- one
- two

End line.`;

describe("buildSuggestionHunks", () => {
  it("returns no hunks for identical text", () => {
    expect(buildSuggestionHunks(BASE, BASE)).toEqual([]);
  });

  it("records a replacement with context", () => {
    const suggested = BASE.replace("Intro paragraph.", "Opening paragraph.");
    const hunks = buildSuggestionHunks(BASE, suggested);

    expect(hunks).toHaveLength(1);
    const hunk = hunks[0];
    expect(hunk?.deletedLines).toEqual(["Intro paragraph."]);
    expect(hunk?.insertedLines).toEqual(["Opening paragraph."]);
    expect(hunk?.contextBefore).toEqual(["# Title", ""]);
    expect(hunk?.contextAfter).toEqual(["", "## Section", ""]);
  });

  it("records pure insertions and deletions", () => {
    const suggested = BASE.replace("- two\n", "").replace(
      "End line.",
      "End line.\nAdded tail.",
    );
    const hunks = buildSuggestionHunks(BASE, suggested);

    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.deletedLines).toEqual(["- two"]);
    expect(hunks[0]?.insertedLines).toEqual([]);
    expect(hunks[1]?.deletedLines).toEqual([]);
    expect(hunks[1]?.insertedLines).toEqual(["Added tail."]);
  });

  it("round-trips through the comment payload", () => {
    const hunks = buildSuggestionHunks(
      BASE,
      BASE.replace("one", "uno").replace("End line.", "Final line."),
    );
    const payload = serializeSuggestions(hunks);

    expect(payload).toContain(SUGGESTION_MARKER);
    expect(payload).toContain("2 changes");
    // Human-readable summary survives for the Drive UI.
    expect(payload.split("\n")[0]).toMatch(/^Suggestion:/);

    const parsed = parseSuggestions(payload);
    expect(parsed).toEqual(hunks);
  });

  it("round-trips non-ASCII text in the payload", () => {
    const suggested = BASE.replace("End line.", "Zażółć gęślą jaźń.");
    const hunks = buildSuggestionHunks(BASE, suggested);
    const parsed = parseSuggestions(serializeSuggestions(hunks));

    expect(parsed?.[0]?.insertedLines).toEqual(["Zażółć gęślą jaźń."]);
  });
});

describe("parseSuggestions", () => {
  it("returns null for ordinary comments", () => {
    expect(parseSuggestions("Could we add the approval step?")).toBeNull();
  });

  it("returns null for malformed payloads", () => {
    expect(
      parseSuggestions(`<!--${SUGGESTION_MARKER} not-base64!@-->`),
    ).toBeNull();
    expect(
      parseSuggestions(`<!--${SUGGESTION_MARKER} YWJjZGVm (broken-->`),
    ).toBeNull();
  });

  it("rejects payload fields with the wrong shape", () => {
    // Hand-built base64 of {"v":1,"hunks":[{"id":1}]} - hunk misses fields.
    const encoded = btoa('{"v":1,"hunks":[{"id":1}]}');
    expect(
      parseSuggestions(`<!--${SUGGESTION_MARKER} ${encoded}-->`),
    ).toBeNull();
  });
});

describe("applySuggestionHunks", () => {
  it("applies hunks to the original document", () => {
    const suggested = BASE.replace("one", "uno").replace(
      "End line.",
      "Final line.",
    );
    const hunks = buildSuggestionHunks(BASE, suggested);
    const result = applySuggestionHunks(BASE, hunks);

    expect(result.content).toBe(suggested);
    expect(result.results).toEqual([
      { hunkId: "hunk-6-0", status: "applied" },
      { hunkId: "hunk-9-1", status: "applied" },
    ]);
  });

  it("applies hunks after earlier lines shifted", () => {
    const suggested = BASE.replace("one", "uno").replace(
      "End line.",
      "Final line.\nExtra line.",
    );
    const hunks = buildSuggestionHunks(BASE, suggested);
    // Someone inserted two lines before the suggested region.
    const shifted = BASE.replace(
      "# Title",
      "# Title\n\nNew paragraph one.\nNew paragraph two.",
    );

    const result = applySuggestionHunks(shifted, hunks);
    expect(result.results.every((r) => r.status === "applied")).toBe(true);
    expect(result.content).toContain("uno");
    expect(result.content).toContain("Final line.");
    expect(result.content).toContain("Extra line.");
    expect(result.content).toContain("New paragraph two.");
  });

  it("marks hunks unresolvable when the target text changed", () => {
    const suggested = BASE.replace("Intro paragraph.", "Opening paragraph.");
    const hunks = buildSuggestionHunks(BASE, suggested);
    // The same line was edited by someone else first.
    const diverged = BASE.replace(
      "Intro paragraph.",
      "Someone else rewrote this.",
    );

    const result = applySuggestionHunks(diverged, hunks);
    expect(result.results[0]?.status).toBe("unresolvable");
    expect(result.content).toBe(diverged);
  });

  it("applies hunks whose context moved elsewhere", () => {
    const suggested = BASE.replace("Intro paragraph.", "Opening paragraph.");
    const hunks = buildSuggestionHunks(BASE, suggested);
    // The whole block moved to the end of the document.
    const moved = [
      "Header A",
      "Header B",
      "# Title",
      "",
      "Intro paragraph.",
      "",
      "## Section",
    ].join("\n");

    const result = applySuggestionHunks(moved, hunks);
    expect(result.results[0]?.status).toBe("applied");
    expect(result.content).toContain("Opening paragraph.");
  });

  it("keeps other hunks when one is unresolvable", () => {
    const suggested = BASE.replace(
      "Intro paragraph.",
      "Opening paragraph.",
    ).replace("one", "uno");
    const hunks = buildSuggestionHunks(BASE, suggested);
    const diverged = BASE.replace(
      "Intro paragraph.",
      "Someone else rewrote this.",
    );

    const result = applySuggestionHunks(diverged, hunks);
    const statuses = result.results.map((r) => r.status);
    expect(statuses).toContain("unresolvable");
    expect(statuses).toContain("applied");
    expect(result.content).toContain("uno");
    expect(result.content).toContain("Someone else rewrote this.");
  });
});
