import { afterEach, describe, expect, it, vi } from "vitest";
import {
  safeGetItem,
  safeSetItem,
  sanitizeStoredText,
} from "../utils/safeStorage";

describe("sanitizeStoredText", () => {
  it("strips control characters while keeping newlines, tabs, and text", () => {
    const dirty = "# Title\n\u0000bad\u0008\u007F text\tkept\r\n";
    expect(sanitizeStoredText(dirty)).toBe("# Title\nbad text\tkept\r\n");
  });

  it("keeps unicode content untouched", () => {
    const value = "Zażółć gęślą jaźń 😀 Σ=∑";
    expect(sanitizeStoredText(value)).toBe(value);
  });

  it("caps stored length to the quota-safe maximum", () => {
    const huge = "a".repeat(3_000_000);
    expect(sanitizeStoredText(huge)).toHaveLength(2_000_000);
  });
});

describe("safeSetItem / safeGetItem", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips a sanitized value", () => {
    safeSetItem("key", "value\u0001");
    expect(safeGetItem("key")).toBe("value");
    expect(localStorage.getItem("key")).toBe("v2:value");
  });

  it("round-trips markdown with spaces and percent signs", () => {
    safeSetItem("key", "# 50% done\nnext step");
    expect(safeGetItem("key")).toBe("# 50% done\nnext step");
  });

  it("reads legacy unversioned entries as raw text", () => {
    localStorage.setItem("key", "# legacy draft");
    expect(safeGetItem("key")).toBe("# legacy draft");
  });

  it("returns null for missing keys", () => {
    expect(safeGetItem("missing")).toBeNull();
  });

  it("tolerates a throwing storage backend", () => {
    const failingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => undefined,
    } as unknown as Storage;
    vi.stubGlobal("localStorage", failingStorage);
    try {
      expect(() => safeSetItem("key", "value")).not.toThrow();
      expect(safeGetItem("key")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
