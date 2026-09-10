import React, { useEffect, useMemo, useState } from "react";
import { X, GitMerge, AlertTriangle } from "lucide-react";
import { threeWayMerge } from "../../utils/diffMerge";

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  localContent: string;
  remoteContent: string;
  baseContent: string;
  onResolve: (resolvedContent: string) => void;
}

/**
 * Save conflict resolution. Shows a precomputed three-way merge and lets
 * the author edit the result directly before it is written back to Drive.
 */
export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onClose,
  localContent,
  remoteContent,
  baseContent,
  onResolve,
}) => {
  const merge = useMemo(
    () => threeWayMerge(baseContent, localContent, remoteContent),
    [baseContent, localContent, remoteContent],
  );
  const [resolvedText, setResolvedText] = useState(merge.content);

  useEffect(() => {
    setResolvedText(merge.content);
  }, [merge]);

  if (!isOpen) return null;

  // Match the full generated markers, not the bare angle bracket: documents
  // that legitimately contain merge-marker-like text must stay saveable.
  const hasConflictMarkers =
    /^<<<<<<< LOCAL$/m.test(resolvedText) ||
    /^>>>>>>> REMOTE$/m.test(resolvedText);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              The document changed on Google Drive
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3 overflow-y-auto">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Someone saved a new version while this document was open. The merged
            text below combines your changes with theirs. Edit it so it reads
            correctly, then save.
          </p>

          {merge.hasConflicts && (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Conflicting passages are marked with LOCAL, BASE, and REMOTE
                blocks. Remove the markers and keep the text you want.
              </span>
            </div>
          )}

          <textarea
            value={resolvedText}
            onChange={(e) => setResolvedText(e.target.value)}
            spellCheck={false}
            aria-label="Merged document content"
            className="w-full flex-1 min-h-[240px] font-mono text-xs leading-relaxed p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
          />
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onResolve(remoteContent)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Use the Drive version
          </button>
          <button
            type="button"
            onClick={() => onResolve(localContent)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Keep my version
          </button>
          <button
            type="button"
            onClick={() => onResolve(resolvedText)}
            disabled={hasConflictMarkers}
            title={
              hasConflictMarkers
                ? "Remove all conflict markers before saving"
                : undefined
            }
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save merged version
          </button>
        </div>
      </div>
    </div>
  );
};
