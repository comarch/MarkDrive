import { describe, expect, it } from "vitest";
import { diffLines } from "../utils/diffMerge";
import {
  collectDiffHunks,
  commentAnchorLine,
  commentSummary,
  matchCommentsToHunks,
} from "../utils/diff";
import { DriveComment } from "../types/drive";

function makeComment(
  id: string,
  line: number | null,
  content = "Looks good overall",
): DriveComment {
  return {
    id,
    kind: "drive#comment",
    createdTime: "2026-01-01T00:00:00Z",
    modifiedTime: "2026-01-01T00:00:00Z",
    author: { displayName: "Anna Reviewer", emailAddress: "a@example.invalid" },
    content,
    htmlContent: content,
    resolved: false,
    anchor:
      line === null
        ? undefined
        : JSON.stringify({
            region: { kind: "drive#commentRegion", line, rev: "head" },
          }),
    replies: [],
  };
}

describe("collectDiffHunks", () => {
  it("groups consecutive changed rows into hunks", () => {
    const base = "a\nb\nc\nd";
    const current = "a\nB\nc\nd\nE";
    const rows = diffLines(base, current);
    const hunks = collectDiffHunks(rows);

    expect(hunks).toHaveLength(2);
    expect(hunks[0]).toMatchObject({
      startLine: 2,
      endLine: 2,
      addedCount: 1,
      removedCount: 1,
    });
    expect(hunks[1]).toMatchObject({
      startLine: 5,
      endLine: 5,
      addedCount: 1,
      removedCount: 0,
    });
  });

  it("returns no hunks for identical documents", () => {
    const rows = diffLines("same\ntext", "same\ntext");
    expect(collectDiffHunks(rows)).toEqual([]);
  });
});

describe("commentAnchorLine", () => {
  it("reads the anchored line from the Drive anchor JSON", () => {
    expect(commentAnchorLine(makeComment("c1", 4))).toBe(4);
  });

  it("returns null for unanchored or malformed comments", () => {
    expect(commentAnchorLine(makeComment("c2", null))).toBeNull();
    const broken = { ...makeComment("c3", 1), anchor: "{not json" };
    expect(commentAnchorLine(broken)).toBeNull();
    const noRegion = { ...makeComment("c4", 1), anchor: "{}" };
    expect(commentAnchorLine(noRegion)).toBeNull();
  });
});

describe("commentSummary", () => {
  it("summarizes author, excerpt, and replies", () => {
    const comment = {
      ...makeComment("c1", 1, "First line of the comment\nsecond line"),
      replies: [{ id: "r1" } as never],
    };
    const summary = commentSummary(comment);

    expect(summary.author).toBe("Anna Reviewer");
    expect(summary.excerpt).toBe("First line of the comment");
    expect(summary.replyCount).toBe(1);
    expect(summary.resolved).toBe(false);
  });

  it("clips long excerpts", () => {
    const long = "x".repeat(120);
    const summary = commentSummary(makeComment("c1", 1, long));
    expect(summary.excerpt.length).toBeLessThanOrEqual(80);
    expect(summary.excerpt.endsWith("...")).toBe(true);
  });
});

describe("matchCommentsToHunks", () => {
  const base = "one\ntwo\nthree\nfour";
  const current = "one\nTWO\nthree\nfour\nfive";
  const hunks = collectDiffHunks(diffLines(base, current));

  it("places comments whose anchor falls inside a hunk", () => {
    const result = matchCommentsToHunks(
      [makeComment("c1", 2), makeComment("c2", 5)],
      hunks,
    );

    expect(result.matched).toHaveLength(2);
    expect(result.matched[0]?.hunk.startLine).toBe(2);
    expect(result.matched[0]?.comments.map((c) => c.id)).toEqual(["c1"]);
    expect(result.matched[1]?.comments.map((c) => c.id)).toEqual(["c2"]);
    expect(result.unmatched).toEqual([]);
  });

  it("falls back to the nearby list for drifted anchors", () => {
    const result = matchCommentsToHunks([makeComment("c1", 1)], hunks);

    expect(result.matched).toEqual([]);
    expect(result.unmatched.map((c) => c.id)).toEqual(["c1"]);
  });

  it("keeps unanchored comments in the fallback list", () => {
    const result = matchCommentsToHunks([makeComment("c1", null)], hunks);

    expect(result.matched).toEqual([]);
    expect(result.unmatched.map((c) => c.id)).toEqual(["c1"]);
  });
});
