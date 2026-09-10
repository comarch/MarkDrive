import React, { useState } from "react";
import {
  CheckCircle2,
  Trash2,
  CornerDownRight,
  Send,
  RotateCcw,
} from "lucide-react";
import { DriveComment } from "../../types/drive";

interface CommentThreadProps {
  comment: DriveComment;
  onReply: (commentId: string, content: string) => Promise<void>;
  onResolve: (commentId: string) => Promise<void>;
  onReopen: (commentId: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  comment,
  onReply,
  onResolve,
  onReopen,
  onDelete,
  isSelected,
  onSelect,
}) => {
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onReply(comment.id, replyText.trim());
      setReplyText("");
      setShowReplyBox(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-xl border transition cursor-pointer ${
        isSelected
          ? "border-brand-500 bg-brand-50/30 dark:bg-brand-950/20 shadow-xs"
          : comment.resolved
            ? "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-75"
            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      {/* Quoted Text if anchored */}
      {comment.quotedFileContent?.value && (
        <div className="mb-2.5 pl-2.5 border-l-2 border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 py-1 pr-2 rounded-r text-xs text-slate-700 dark:text-slate-300 italic line-clamp-2">
          &ldquo;{comment.quotedFileContent.value}&rdquo;
        </div>
      )}

      {/* Main Comment Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {comment.author?.photoLink ? (
            <img
              src={comment.author.photoLink}
              alt={comment.author.displayName}
              className="w-6 h-6 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {comment.author?.displayName?.charAt(0) || "U"}
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {comment.author?.displayName || "User"}
            </div>
            <div className="text-[10px] text-slate-400">
              {formattedDate(comment.createdTime)}
            </div>
          </div>
        </div>

        {/* Actions (Resolve / Reopen / Delete) */}
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {comment.resolved ? (
            <button
              onClick={() => onReopen(comment.id)}
              title="Re-open discussion"
              className="p-1 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onResolve(comment.id)}
              title="Resolve discussion"
              className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onDelete(comment.id)}
            title="Delete comment"
            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Comment Body */}
      <div className="mt-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
        {comment.content}
      </div>

      {/* Replies List */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-2 pl-3 border-l-2 border-slate-200 dark:border-slate-800">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  {reply.author?.displayName || "User"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {formattedDate(reply.createdTime)}
                </span>
                {reply.action === "resolve" && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    (marked as resolved)
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                {reply.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Trigger or Input */}
      {!comment.resolved && (
        <div
          className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {showReplyBox ? (
            <form onSubmit={handleSendReply} className="flex flex-col gap-1.5">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={2}
                autoFocus
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowReplyBox(false)}
                  className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSubmitting}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-md disabled:opacity-50 transition"
                >
                  <Send className="w-3 h-3" />
                  <span>Reply</span>
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowReplyBox(true)}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 font-medium transition"
            >
              <CornerDownRight className="w-3 h-3" />
              <span>Reply</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
