import { describe, expect, it } from "vitest";
import { diffLines, threeWayMerge } from "../utils/diffMerge";

describe("diffLines", () => {
  it("returns equal rows with one-based numbering for identical input", () => {
    expect(diffLines("first\nsecond", "first\nsecond")).toEqual([
      {
        type: "equal",
        left: "first",
        leftNumber: 1,
        right: "first",
        rightNumber: 1,
      },
      {
        type: "equal",
        left: "second",
        leftNumber: 2,
        right: "second",
        rightNumber: 2,
      },
    ]);
  });

  it("orders removed and added rows for a middle-line change", () => {
    expect(diffLines("first\nold\nlast", "first\nnew\nlast")).toEqual([
      {
        type: "equal",
        left: "first",
        leftNumber: 1,
        right: "first",
        rightNumber: 1,
      },
      {
        type: "removed",
        left: "old",
        leftNumber: 2,
      },
      {
        type: "added",
        right: "new",
        rightNumber: 2,
      },
      {
        type: "equal",
        left: "last",
        leftNumber: 3,
        right: "last",
        rightNumber: 3,
      },
    ]);
  });

  it("handles pure insertion", () => {
    expect(diffLines("first\nlast", "first\nmiddle\nlast")).toEqual([
      {
        type: "equal",
        left: "first",
        leftNumber: 1,
        right: "first",
        rightNumber: 1,
      },
      {
        type: "added",
        right: "middle",
        rightNumber: 2,
      },
      {
        type: "equal",
        left: "last",
        leftNumber: 2,
        right: "last",
        rightNumber: 3,
      },
    ]);
  });

  it("handles pure deletion", () => {
    expect(diffLines("first\nmiddle\nlast", "first\nlast")).toEqual([
      {
        type: "equal",
        left: "first",
        leftNumber: 1,
        right: "first",
        rightNumber: 1,
      },
      {
        type: "removed",
        left: "middle",
        leftNumber: 2,
      },
      {
        type: "equal",
        left: "last",
        leftNumber: 3,
        right: "last",
        rightNumber: 2,
      },
    ]);
  });

  it("handles empty inputs and empty-side changes", () => {
    expect(diffLines("", "")).toEqual([]);
    expect(diffLines("", "only line")).toEqual([
      {
        type: "added",
        right: "only line",
        rightNumber: 1,
      },
    ]);
    expect(diffLines("only line", "")).toEqual([
      {
        type: "removed",
        left: "only line",
        leftNumber: 1,
      },
    ]);
  });

  it("uses the trivial fallback for inputs over the line limit", () => {
    const largeInput = Array.from(
      { length: 6000 },
      (_, index) => `line ${index + 1}`,
    ).join("\n");
    const rows = diffLines(largeInput, "");

    expect(rows).toHaveLength(6000);
    expect(rows[0]).toEqual({
      type: "removed",
      left: "line 1",
      leftNumber: 1,
    });
    expect(rows[5999]).toEqual({
      type: "removed",
      left: "line 6000",
      leftNumber: 6000,
    });
  });
});

describe("threeWayMerge", () => {
  it("returns identical local and remote content without conflicts", () => {
    expect(threeWayMerge("base", "same", "same")).toEqual({
      content: "same",
      hasConflicts: false,
    });
  });

  it("merges disjoint edits", () => {
    expect(
      threeWayMerge("one\ntwo\nthree", "ONE\ntwo\nthree", "one\ntwo\nTHREE"),
    ).toEqual({
      content: "ONE\ntwo\nTHREE",
      hasConflicts: false,
    });
  });

  it("emits all conflict markers for different same-line edits", () => {
    const result = threeWayMerge("same", "local", "remote");

    expect(result.hasConflicts).toBe(true);
    expect(result.content).toBe(
      "<<<<<<< LOCAL\nlocal\n||||||| BASE\nsame\n=======\nremote\n>>>>>>> REMOTE",
    );
  });

  it("combines an end insertion with a middle deletion", () => {
    expect(
      threeWayMerge("one\ntwo\nthree", "one\ntwo\nthree\nfour", "one\nthree"),
    ).toEqual({
      content: "one\nthree\nfour",
      hasConflicts: false,
    });
  });

  it("handles identical deletions cleanly", () => {
    expect(
      threeWayMerge("one\ntwo\nthree", "one\nthree", "one\nthree"),
    ).toEqual({
      content: "one\nthree",
      hasConflicts: false,
    });
  });

  it("conflicts on different insertions at one base position", () => {
    const result = threeWayMerge(
      "before\nafter",
      "before\nlocal\nafter",
      "before\nremote\nafter",
    );

    expect(result.hasConflicts).toBe(true);
    expect(result.content).toContain("<<<<<<< LOCAL");
    expect(result.content).toContain("||||||| BASE");
    expect(result.content).toContain("=======");
    expect(result.content).toContain(">>>>>>> REMOTE");
  });

  it("merges identical additions into an empty base", () => {
    expect(threeWayMerge("", "added", "added")).toEqual({
      content: "added",
      hasConflicts: false,
    });
  });

  it("conflicts on different additions into an empty base", () => {
    expect(threeWayMerge("", "local", "remote")).toEqual({
      content:
        "<<<<<<< LOCAL\nlocal\n||||||| BASE\n=======\nremote\n>>>>>>> REMOTE",
      hasConflicts: true,
    });
  });

  it("preserves a document with no trailing newline", () => {
    expect(
      threeWayMerge("first\nsecond", "FIRST\nsecond", "first\nSECOND"),
    ).toEqual({
      content: "FIRST\nSECOND",
      hasConflicts: false,
    });
  });

  it("keeps conflict-marker-like input as plain text", () => {
    const result = threeWayMerge("base", "<<<<<<< LOCAL", "remote");

    expect(result.hasConflicts).toBe(true);
    expect(result.content).toContain("<<<<<<< LOCAL\n<<<<<<< LOCAL");
  });

  it("handles empty documents", () => {
    expect(threeWayMerge("", "", "")).toEqual({
      content: "",
      hasConflicts: false,
    });
  });
});
