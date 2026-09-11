import React, { useMemo } from "react";
import { X, History, RotateCcw, RefreshCw, MessageSquare } from "lucide-react";
import { DriveComment, DriveRevision } from "../../types/drive";
import { diffLines } from "../../utils/diffMerge";
import {
  collectDiffHunks,
  commentSummary,
  matchCommentsToHunks,
} from "../../utils/diff";

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  revisions: DriveRevision[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  selectedContent: string | null;
  currentContent: string;
  comments: DriveComment[];
  onSelect: (revisionId: string) => void;
  onRestore: (revisionId: string) => void;
  onRefresh: () => void;
  onSelectComment?: (commentId: string) => void;
}

function formatRevisionTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Drive version history. Lists revisions, previews the selected one as a
 * diff against the open document, and restores content on demand.
 */
export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  revisions,
  loading,
  error,
  selectedId,
  selectedContent,
  currentContent,
  comments,
  onSelect,
  onRestore,
  onRefresh,
  onSelectComment,
}) => {
  const diffRows = useMemo(() => {
    if (selectedContent === null) return [];
    // Rows have no natural id, so build one from the row itself and count
    // duplicates so adjacent identical lines still get unique React keys.
    const seen = new Map<string, number>();
    return diffLines(selectedContent, currentContent).map((row) => {
      const base = `${row.type}:${row.left ?? ""}:${row.right ?? ""}`;
      const occurrence = (seen.get(base) ?? 0) + 1;
      seen.set(base, occurrence);
      return { ...row, key: occurrence > 1 ? `${base}#${occurrence}` : base };
    });
  }, [selectedContent, currentContent]);

  const addedCount = diffRows.filter((row) => row.type === "added").length;
  const removedCount = diffRows.filter((row) => row.type === "removed").length;

  // Discussion attached to the changed regions, plus drifted anchors.
  const discussion = useMemo(() => {
    if (selectedContent === null || comments.length === 0) {
      return { matched: [], unmatched: [] };
    }
    return matchCommentsToHunks(comments, collectDiffHunks(diffRows));
  }, [selectedContent, comments, diffRows]);

  if (!isOpen) return null;

  return (
    <div className="w-80 shrink-0 h-full bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-md no-print select-none">
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Version history
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            title="Refresh revisions"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Revision list */}
      <div className="max-h-[45%] overflow-y-auto p-2 space-y-1 border-b border-slate-200 dark:border-slate-800">
        {error && (
          <div className="text-xs text-rose-600 dark:text-rose-400 px-2 py-3">
            Could not load revisions: {error}
          </div>
        )}

        {!error && loading && revisions.length === 0 && (
          <div className="text-center py-6 text-slate-400 text-xs">
            Loading revisions...
          </div>
        )}

        {!error && !loading && revisions.length === 0 && (
          <div className="text-center py-6 px-3 text-slate-400 text-xs">
            No earlier versions yet. Versions appear here after the document is
            saved to Google Drive.
          </div>
        )}

        {revisions.map((revision) => {
          const isSelected = revision.id === selectedId;
          return (
            <button
              key={revision.id}
              onClick={() => onSelect(revision.id)}
              className={`w-full text-left px-3 py-2 rounded-lg transition ${
                isSelected
                  ? "bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <div className="text-xs font-medium truncate">
                {formatRevisionTime(revision.modifiedTime) || revision.id}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {revision.lastModifyingUser?.displayName || "Saved version"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected revision diff against the open document */}
      <div className="flex-1 overflow-y-auto p-3">
        {selectedContent === null ? (
          <div className="text-center py-6 px-3 text-slate-400 text-xs">
            Select a version to compare it with the open document.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {addedCount} added, {removedCount} removed in the open document
              </span>
              <button
                onClick={() => selectedId && onRestore(selectedId)}
                disabled={!selectedId}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-brand-600 hover:bg-brand-700 text-white shadow-xs disabled:opacity-40"
              >
                <RotateCcw className="w-3 h-3" />
                Restore
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden font-mono text-[11px] leading-snug">
              {addedCount === 0 && removedCount === 0 ? (
                <div className="px-3 py-3 text-slate-400">
                  No difference with the open document.
                </div>
              ) : (
                diffRows.map((row) => {
                  if (row.type === "equal") {
                    return (
                      <div
                        key={row.key}
                        className="px-3 py-0.5 text-slate-400 dark:text-slate-500 truncate whitespace-pre-wrap break-all"
                      >
                        {row.right}
                      </div>
                    );
                  }
                  if (row.type === "removed") {
                    return (
                      <div
                        key={row.key}
                        className="px-3 py-0.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 truncate whitespace-pre-wrap break-all"
                      >
                        - {row.left}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={row.key}
                      className="px-3 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 truncate whitespace-pre-wrap break-all"
                    >
                      + {row.right}
                    </div>
                  );
                })
              )}
            </div>

            {/* Discussion attached to the changed regions */}
            {(discussion.matched.length > 0 ||
              discussion.unmatched.length > 0) && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Discussion on these changes</span>
                </div>

                {discussion.matched.map(({ hunk, comments: hunkComments }) => (
                  <div
                    key={`${hunk.startLine}-${hunk.endLine}`}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 space-y-1"
                  >
                    <div className="text-[10px] text-slate-400">
                      Lines {hunk.startLine}-{hunk.endLine} (+
                      {hunk.addedCount} / -{hunk.removedCount})
                    </div>
                    {hunkComments.map((comment) => {
                      const summary = commentSummary(comment);
                      return (
                        <button
                          key={comment.id}
                          onClick={() => onSelectComment?.(comment.id)}
                          className="w-full text-left px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                              {summary.author}
                            </span>
                            {summary.resolved && (
                              <span className="text-[9px] text-emerald-600">
                                resolved
                              </span>
                            )}
                            {summary.replyCount > 0 && (
                              <span className="text-[9px] text-slate-400">
                                {summary.replyCount} repl
                                {summary.replyCount === 1 ? "y" : "ies"}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {summary.excerpt}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}

                {discussion.unmatched.length > 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-2 space-y-1">
                    <div className="text-[10px] text-slate-400">
                      Nearby discussion (anchor no longer inside a change)
                    </div>
                    {discussion.unmatched.map((comment) => {
                      const summary = commentSummary(comment);
                      return (
                        <button
                          key={comment.id}
                          onClick={() => onSelectComment?.(comment.id)}
                          className="w-full text-left px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                            {summary.author}
                          </span>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {summary.excerpt}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
