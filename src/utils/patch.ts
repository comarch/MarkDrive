import { diffLines } from "./diffMerge";

// Suggestion mode records proposed edits as a patch stored in a Drive
// comment thread, never in the file itself. Each hunk carries context so
// it can still be applied after the document moved on.

export interface SuggestionHunk {
  id: string;
  anchorLine: number;
  deletedLines: string[];
  insertedLines: string[];
  contextBefore: string[];
  contextAfter: string[];
}

export interface HunkApplyResult {
  hunkId: string;
  status: "applied" | "unresolvable";
}

export interface SuggestionApplyResult {
  content: string;
  results: HunkApplyResult[];
}

interface SuggestionPayload {
  v: 1;
  hunks: SuggestionHunk[];
}

export const SUGGESTION_MARKER = "mq-suggest:v1";
const CONTEXT_LINES = 3;

function splitLines(content: string): string[] {
  return content.length === 0 ? [] : content.split("\n");
}

function contextWindow(lines: string[], end: number, count: number): string[] {
  const start = Math.max(0, end - count);
  return lines.slice(start, end);
}

/**
 * Extracts the change hunks between the document the suggester started
 * from and the text they propose. Unchanged runs become hunk context.
 */
export function buildSuggestionHunks(
  base: string,
  suggested: string,
): SuggestionHunk[] {
  const baseLines = splitLines(base);
  const rows = diffLines(base, suggested);
  const hunks: SuggestionHunk[] = [];
  let baseLine = 0;
  let current: {
    deleted: string[];
    inserted: string[];
    anchor: number;
  } | null = null;

  const flush = (): void => {
    if (current === null) return;
    if (current.deleted.length === 0 && current.inserted.length === 0) {
      current = null;
      return;
    }
    hunks.push({
      id: `hunk-${current.anchor}-${hunks.length}`,
      anchorLine: current.anchor,
      deletedLines: current.deleted,
      insertedLines: current.inserted,
      contextBefore: contextWindow(baseLines, current.anchor, CONTEXT_LINES),
      contextAfter: baseLines.slice(
        current.anchor + current.deleted.length,
        current.anchor + current.deleted.length + CONTEXT_LINES,
      ),
    });
    current = null;
  };

  for (const row of rows) {
    if (row.type === "equal") {
      flush();
      baseLine += 1;
    } else if (row.type === "removed") {
      current ??= { deleted: [], inserted: [], anchor: baseLine };
      if (row.left !== undefined) current.deleted.push(row.left);
      baseLine += 1;
    } else {
      current ??= { deleted: [], inserted: [], anchor: baseLine };
      if (row.right !== undefined) current.inserted.push(row.right);
    }
  }
  flush();

  return hunks;
}

function encodePayload(payload: SuggestionPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
}

function decodePayload(encoded: string): SuggestionPayload | null {
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.codePointAt(index) ?? 0;
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as SuggestionPayload;
    if (parsed?.v !== 1 || !Array.isArray(parsed.hunks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isHunkShape(value: unknown): value is SuggestionHunk {
  if (typeof value !== "object" || value === null) return false;
  const hunk = value as Record<string, unknown>;
  return (
    typeof hunk.id === "string" &&
    typeof hunk.anchorLine === "number" &&
    Array.isArray(hunk.deletedLines) &&
    Array.isArray(hunk.insertedLines) &&
    Array.isArray(hunk.contextBefore) &&
    Array.isArray(hunk.contextAfter)
  );
}

/**
 * Serializes hunks into a comment body that stays readable in the Drive
 * UI while carrying the machine payload in an HTML comment.
 */
export function serializeSuggestions(hunks: SuggestionHunk[]): string {
  const changeCount = hunks.length;
  const summary = `Suggestion: ${changeCount} change${
    changeCount === 1 ? "" : "s"
  } proposed in MarkQuire`;
  return `${summary}\n<!--${SUGGESTION_MARKER} ${encodePayload({
    v: 1,
    hunks,
  })}-->`;
}

/**
 * Parses a comment body back into hunks. Returns null for ordinary
 * comments, malformed payloads, or non-array hunk lists.
 */
const SUGGESTION_PATTERN = new RegExp(
  `<!--${SUGGESTION_MARKER} ([A-Za-z0-9+/=]+)-->`,
);

export function parseSuggestions(content: string): SuggestionHunk[] | null {
  const match = SUGGESTION_PATTERN.exec(content);
  if (match?.[1] === undefined) return null;
  const payload = decodePayload(match[1]);
  if (!payload) return null;
  if (!payload.hunks.every(isHunkShape)) return null;
  return payload.hunks;
}

function blockMatches(
  lines: string[],
  position: number,
  expected: string[],
): boolean {
  if (position < 0 || position + expected.length > lines.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (lines[position + index] !== expected[index]) return false;
  }
  return true;
}

function findBlock(
  lines: string[],
  expected: string[],
  fromPosition: number,
): number {
  // Try the anchored position first, then scan for a moved but identical
  // block. Scanning is bounded by the document, which is already loaded.
  for (let position = fromPosition; position <= lines.length; position += 1) {
    if (blockMatches(lines, position, expected)) return position;
  }
  for (let position = 0; position < fromPosition; position += 1) {
    if (blockMatches(lines, position, expected)) return position;
  }
  return -1;
}

/**
 * Applies suggestion hunks to the current markdown. Each hunk is
 * anchored by its original context; when the anchor no longer matches
 * anywhere, that hunk is reported as unresolvable and left out instead
 * of corrupting the document.
 */
export function applySuggestionHunks(
  markdown: string,
  hunks: SuggestionHunk[],
): SuggestionApplyResult {
  const lines = splitLines(markdown);
  const results: HunkApplyResult[] = [];
  // Offset between base line numbers in the payload and the live document.
  let shift = 0;

  const sorted = [...hunks].sort(
    (left, right) => left.anchorLine - right.anchorLine,
  );

  for (const hunk of sorted) {
    const expectedPosition = hunk.anchorLine + shift;
    const anchorBlock = [...hunk.contextBefore, ...hunk.deletedLines];
    let deletedStart = -1;

    if (anchorBlock.length === 0) {
      // Insertion at the very start of the document, no context at all.
      deletedStart = Math.max(0, expectedPosition);
    } else if (blockMatches(lines, expectedPosition, anchorBlock)) {
      deletedStart = expectedPosition + hunk.contextBefore.length;
    } else {
      // Someone moved the block. Try the full anchor anywhere first; it
      // is the strongest match.
      const anchored = findBlock(lines, anchorBlock, expectedPosition);
      if (anchored >= 0) {
        deletedStart = anchored + hunk.contextBefore.length;
      }
    }

    // An earlier hunk may have rewritten this hunk's context lines, so
    // fall back to the deleted lines themselves, which carry the exact
    // text being replaced. Insertions without deletions fall back to the
    // context after them.
    if (deletedStart < 0 && hunk.deletedLines.length > 0) {
      deletedStart = findBlock(lines, hunk.deletedLines, expectedPosition);
    } else if (deletedStart < 0 && hunk.contextAfter.length > 0) {
      const after = findBlock(lines, hunk.contextAfter, expectedPosition);
      if (after >= 0) {
        deletedStart = Math.max(0, after - hunk.contextBefore.length);
      }
    }

    if (deletedStart < 0) {
      results.push({ hunkId: hunk.id, status: "unresolvable" });
      continue;
    }

    // The deleted lines must match exactly where the anchor put them,
    // otherwise someone already edited the same region differently.
    if (!blockMatches(lines, deletedStart, hunk.deletedLines)) {
      results.push({ hunkId: hunk.id, status: "unresolvable" });
      continue;
    }

    lines.splice(deletedStart, hunk.deletedLines.length, ...hunk.insertedLines);
    shift =
      deletedStart -
      hunk.anchorLine -
      hunk.deletedLines.length +
      hunk.insertedLines.length;
    results.push({ hunkId: hunk.id, status: "applied" });
  }

  return { content: lines.join("\n"), results };
}
