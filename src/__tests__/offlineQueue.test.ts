import { describe, expect, it } from "vitest";
import {
  decideReplay,
  isNetworkError,
  mergeQueuedSaves,
  replayQueue,
  type OfflineSaveEntry,
} from "../services/offlineQueue";

const entry = (
  overrides: Partial<OfflineSaveEntry> = {},
): OfflineSaveEntry => ({
  fileId: "file-1",
  name: "Doc.md",
  content: "queued content",
  baseRevisionId: "rev-1",
  baseContent: "base content",
  savedAt: "2024-01-01T10:00:00Z",
  ...overrides,
});

describe("offline queue decisions", () => {
  it("saves when the Drive head matches the queued base", () => {
    expect(decideReplay(entry(), "rev-1")).toBe("save");
  });

  it("conflicts when Drive moved ahead", () => {
    expect(decideReplay(entry(), "rev-2")).toBe("conflict");
  });

  it("saves when either revision is unknown", () => {
    expect(decideReplay(entry({ baseRevisionId: null }), "rev-9")).toBe("save");
    expect(decideReplay(entry(), null)).toBe("save");
  });

  it("keeps only the newest save per file", () => {
    const merged = mergeQueuedSaves([
      entry({ content: "older", savedAt: "2024-01-01T10:00:00Z" }),
      entry({ content: "newer", savedAt: "2024-01-01T11:00:00Z" }),
      entry({
        fileId: "file-2",
        content: "other",
        savedAt: "2024-01-01T09:00:00Z",
      }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.fileId === "file-1")?.content).toBe("newer");
    expect(merged.find((e) => e.fileId === "file-2")?.content).toBe("other");
  });
});

describe("offline queue replay", () => {
  it("replays clean saves and reports them", async () => {
    const updated: string[] = [];
    const result = await replayQueue(
      [entry(), entry({ fileId: "file-2", baseRevisionId: "r2" })],
      {
        fetchHeadRevisionId: async (fileId) =>
          fileId === "file-1" ? "rev-1" : "r2",
        getFile: async () => ({ content: "remote" }),
        updateFile: async (fileId, content) => {
          updated.push(`${fileId}:${content}`);
        },
      },
    );
    expect(updated).toEqual(["file-1:queued content", "file-2:queued content"]);
    expect(result.replayed).toHaveLength(2);
    expect(result.conflicts).toHaveLength(0);
    expect(result.failures).toHaveLength(0);
  });

  it("stops a conflicting file with its remote content, saves the rest", async () => {
    const conflicts: string[] = [];
    const result = await replayQueue(
      [
        entry({ fileId: "clean", baseRevisionId: "a" }),
        entry({ fileId: "dirty", baseRevisionId: "b" }),
      ],
      {
        fetchHeadRevisionId: async (fileId) => (fileId === "clean" ? "a" : "z"),
        getFile: async () => ({ content: "remote version" }),
        updateFile: async () => {},
      },
      (saved) => conflicts.push(saved.fileId),
    );
    expect(result.replayed.map((e) => e.fileId)).toEqual(["clean"]);
    expect(result.conflicts).toEqual([
      {
        entry: expect.objectContaining({ fileId: "dirty" }),
        remoteContent: "remote version",
      },
    ]);
  });

  it("keeps entries whose replay fails", async () => {
    const result = await replayQueue([entry()], {
      fetchHeadRevisionId: async () => {
        throw new Error("still offline");
      },
      getFile: async () => ({ content: "" }),
      updateFile: async () => {},
    });
    expect(result.failures).toHaveLength(1);
    expect(result.replayed).toHaveLength(0);

    const failing = await replayQueue([entry()], {
      fetchHeadRevisionId: async () => "rev-1",
      getFile: async () => ({ content: "" }),
      updateFile: async () => {
        throw new Error("403");
      },
    });
    expect(failing.failures).toHaveLength(1);
  });
});

describe("network error detection", () => {
  it("recognizes TypeError fetch failures and navigator state", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("400"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
