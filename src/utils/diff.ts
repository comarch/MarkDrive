import { DriveComment } from "../types/drive";
import { DiffRow } from "./diffMerge";

// Revision review: map comment threads onto the changed regions of a
// revision diff, with a fallback for anchors that no longer line up.

export interface DiffHunk {
  /** First changed line in the newer document, 1-based. */
  startLine: number;
  /** Last changed line in the newer document, 1-based. */
  endLine: number;
  addedCount: number;
  removedCount: number;
}

export interface HunkDiscussion {
  hunk: DiffHunk;
  comments: DriveComment[];
}

export interface RevisionDiscussion {
  matched: HunkDiscussion[];
  /** Anchored comments whose line no longer falls in a changed region. */
  unmatched: DriveComment[];
}

export function collectDiffHunks(rows: DiffRow[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;

  const flush = (): void => {
    if (current && current.addedCount + current.removedCount > 0) {
      hunks.push(current);
    }
    current = null;
  };

  for (const row of rows) {
    if (row.type === "equal") {
      flush();
      continue;
    }

    current ??= {
      startLine: row.type === "added" ? (row.rightNumber ?? 0) : 0,
      endLine: 0,
      addedCount: 0,
      removedCount: 0,
    };
    if (row.type === "added") {
      current.addedCount += 1;
      current.endLine = Math.max(current.endLine, row.rightNumber ?? 0);
      if (current.startLine === 0) {
        current.startLine = row.rightNumber ?? 0;
      }
    } else {
      current.removedCount += 1;
    }
  }
  flush();

  return hunks;
}

/**
 * Extracts the anchored line from a Drive comment. Returns null for
 * unanchored comments and anchors the app cannot interpret.
 */
export function commentAnchorLine(comment: DriveComment): number | null {
  if (!comment.anchor) return null;
  try {
    const parsed = JSON.parse(comment.anchor) as {
      region?: { line?: unknown };
    };
    const line = parsed?.region?.line;
    return typeof line === "number" && Number.isFinite(line) ? line : null;
  } catch {
    return null;
  }
}

function commentExcerpt(comment: DriveComment): string {
  const text = comment.content.split("\n")[0] ?? "";
  return text.length > 80 ? `${text.slice(0, 77)}...` : text || "(no text)";
}

export interface CommentSummary {
  id: string;
  author: string;
  excerpt: string;
  resolved: boolean;
  replyCount: number;
}

export function commentSummary(comment: DriveComment): CommentSummary {
  return {
    id: comment.id,
    author: comment.author?.displayName || "User",
    excerpt: commentExcerpt(comment),
    resolved: comment.resolved === true,
    replyCount: comment.replies?.length ?? 0,
  };
}

/**
 * Places each anchored comment on the diff hunk covering its line.
 * Comments whose anchor drifted outside every hunk land in the
 * fallback list instead of being dropped silently.
 */
export function matchCommentsToHunks(
  comments: DriveComment[],
  hunks: DiffHunk[],
): RevisionDiscussion {
  const matched: HunkDiscussion[] = hunks.map((hunk) => ({
    hunk,
    comments: [],
  }));
  const unmatched: DriveComment[] = [];

  for (const comment of comments) {
    const line = commentAnchorLine(comment);
    if (line === null) {
      // Unanchored threads may still discuss the changes; keep them in
      // the fallback section rather than guessing a position.
      unmatched.push(comment);
      continue;
    }

    const target = matched.find(
      ({ hunk }) => line >= hunk.startLine && line <= hunk.endLine,
    );
    if (target) {
      target.comments.push(comment);
    } else {
      unmatched.push(comment);
    }
  }

  return {
    matched: matched.filter(({ comments: list }) => list.length > 0),
    unmatched,
  };
}
