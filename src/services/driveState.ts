import { DriveStateParam } from "../types/drive";

const MAX_STATE_LENGTH = 8192;
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseId(value: unknown): string | undefined {
  return typeof value === "string" && DRIVE_ID_PATTERN.test(value)
    ? value
    : undefined;
}

function parseResourceKeys(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value);
  if (
    entries.length > 100 ||
    entries.some(
      ([key, resourceKey]) =>
        !DRIVE_ID_PATTERN.test(key) || parseId(resourceKey) === undefined,
    )
  ) {
    return undefined;
  }

  return Object.fromEntries(entries) as Record<string, string>;
}

function normalizeDriveState(value: unknown): DriveStateParam | null {
  if (!isRecord(value)) return null;

  if (value.action === "open") {
    if (!Array.isArray(value.ids) || value.ids.length !== 1) return null;
    const fileId = parseId(value.ids[0]);
    if (!fileId) return null;

    return {
      action: "open",
      ids: [fileId],
      folderResourceKey: parseId(value.folderResourceKey),
      resourceKeys: parseResourceKeys(value.resourceKeys),
      userId: parseId(value.userId),
    };
  }

  if (value.action === "create") {
    const folderId = parseId(value.folderId);
    if (value.folderId !== undefined && !folderId) return null;

    return {
      action: "create",
      folderId,
      folderResourceKey: parseId(value.folderResourceKey),
      resourceKeys: parseResourceKeys(value.resourceKeys),
      userId: parseId(value.userId),
    };
  }

  return null;
}

/**
 * Parses URL query parameters when opened from Google Drive UI
 * (e.g., from "Nowy" / "Create" or "Open with" context menu)
 */
export function parseDriveStateFromUrl(
  customSearch?: string,
): DriveStateParam | null {
  const search =
    customSearch !== undefined
      ? customSearch
      : typeof window !== "undefined"
        ? window.location.search
        : "";
  const urlParams = new URLSearchParams(search);
  const stateQuery = urlParams.get("state");

  if (stateQuery && stateQuery.length <= MAX_STATE_LENGTH) {
    try {
      return normalizeDriveState(JSON.parse(stateQuery));
    } catch (err) {
      console.warn("Failed to parse Google Drive state param:", err);
    }
  }

  // Fallback for direct query parameters: ?fileId=... or ?action=create&folderId=...
  const fileId = urlParams.get("fileId") || urlParams.get("id");
  if (fileId && DRIVE_ID_PATTERN.test(fileId)) {
    return {
      action: "open",
      ids: [fileId],
    };
  }

  const folderId = urlParams.get("folderId");
  if (folderId || urlParams.get("action") === "create") {
    if (folderId && !DRIVE_ID_PATTERN.test(folderId)) return null;
    return {
      action: "create",
      folderId: folderId || undefined,
    };
  }

  return null;
}

/**
 * Reads a passage deep link from the URL hash: #line=12 opens the
 * document scrolled to that line. Returns null for anything else.
 */
export function parseLineAnchorFromUrl(customHash?: string): number | null {
  const hash =
    customHash ?? (typeof window === "undefined" ? "" : window.location.hash);
  const match = /^#line=(\d{1,7})$/.exec(hash);
  if (!match) return null;
  const line = Number.parseInt(match[1] ?? "0", 10);
  return Number.isFinite(line) && line > 0 ? line : null;
}

/**
 * Builds a shareable passage link for the given file and line.
 */
export function buildPassageLink(fileId: string | null, line: number): string {
  if (typeof window === "undefined") return `#line=${line}`;
  const url = new URL(window.location.href);
  url.hash = `line=${line}`;
  url.searchParams.delete("state");
  if (fileId) {
    url.searchParams.set("fileId", fileId);
  } else {
    url.searchParams.delete("fileId");
  }
  return url.toString();
}

/**
 * Updates URL parameters without page reload
 */
export function updateUrlFileId(fileId: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete("state");
  if (fileId) {
    url.searchParams.set("fileId", fileId);
  } else {
    url.searchParams.delete("fileId");
  }
  window.history.replaceState({}, "", url.toString());
}
