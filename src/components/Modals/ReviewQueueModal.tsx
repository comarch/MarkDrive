import React, { useCallback, useEffect, useState } from "react";
import { X, ListChecks, RefreshCw, Inbox } from "lucide-react";
import { DriveFileMetadata } from "../../types/drive";
import { driveService } from "../../services/googleDrive";
import { parseFrontmatter } from "../../utils/frontmatter";
import { REVIEW_STATUS_FIELD } from "../../utils/reviewStatus";

interface ReviewQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFile: (fileId: string) => void;
}

interface QueueEntry {
  metadata: DriveFileMetadata;
  status: string;
}

// Reading frontmatter for every file costs one GET each; the queue caps
// how many documents it inspects so opening it stays responsive.
const MAX_INSPECTED_FILES = 25;

/**
 * Documents whose frontmatter asks for review, most recent first.
 */
export const ReviewQueueModal: React.FC<ReviewQueueModalProps> = ({
  isOpen,
  onClose,
  onOpenFile,
}) => {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const files = await driveService.listMarkdownFiles();
      const inspected = files.slice(0, MAX_INSPECTED_FILES);
      const queue: QueueEntry[] = [];
      for (const file of inspected) {
        if (!file.id) continue;
        try {
          const result = await driveService.getFile(file.id);
          const fields = parseFrontmatter(result.content).fields;
          const status = fields[REVIEW_STATUS_FIELD];
          if (status === "in-review") {
            queue.push({ metadata: file, status: String(status) });
          }
        } catch {
          // Files that fail to load are skipped, not fatal for the queue.
        }
      }
      setEntries(queue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadQueue();
    }
  }, [isOpen, loadQueue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Awaiting review
            </h3>
            {entries.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {entries.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => void loadQueue()}
              title="Refresh review queue"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={onClose}
              title="Close review queue"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3 overflow-y-auto flex-1 space-y-1.5">
          {error && (
            <div className="text-xs text-rose-600 dark:text-rose-400 px-2 py-3">
              Could not load the review queue: {error}
            </div>
          )}

          {!error && loading && entries.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs">
              Loading review queue...
            </div>
          )}

          {!error && !loading && entries.length === 0 && (
            <div className="text-center py-8 px-4 text-slate-400 text-xs">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium">No documents awaiting review.</p>
              <p className="text-[11px] mt-1 text-slate-400">
                Set the review status of a document to In review to queue it
                here.
              </p>
            </div>
          )}

          {entries.map(({ metadata }) => (
            <button
              key={metadata.id}
              onClick={() => {
                onOpenFile(metadata.id ?? "");
                onClose();
              }}
              className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-950/20 transition"
            >
              <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                {metadata.name}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {metadata.modifiedTime
                  ? `Modified ${new Date(metadata.modifiedTime).toLocaleDateString()}`
                  : "Ready for review"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
