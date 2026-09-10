import React, { useState } from "react";
import { X, MessageSquarePlus, Send } from "lucide-react";
import { SelectionInfo } from "../../types/editor";

interface NewCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selection: SelectionInfo | null;
  onSubmit: (
    content: string,
    quotedText?: string,
    line?: number,
  ) => Promise<void>;
}

export const NewCommentModal: React.FC<NewCommentModalProps> = ({
  isOpen,
  onClose,
  selection,
  onSubmit,
}) => {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSubmit(content.trim(), selection?.text, selection?.line);
      setContent("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Add Google Drive Comment
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          {/* Quoted Text if selected */}
          {selection?.text ? (
            <div>
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                Selected Text (Line {selection.line})
              </label>
              <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border-l-2 border-amber-500 rounded text-xs text-slate-700 dark:text-slate-300 italic line-clamp-3">
                &ldquo;{selection.text}&rdquo;
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Adding a general document comment.
            </div>
          )}

          {/* Comment text area */}
          <div>
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Comment
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your comment here..."
              rows={4}
              autoFocus
              className="w-full text-sm p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Posting..." : "Post Comment"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
