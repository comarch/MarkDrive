import React from "react";
import { MessageSquarePlus } from "lucide-react";
import { SelectionInfo } from "../../types/editor";

interface FloatingCommentButtonProps {
  selection: SelectionInfo | null;
  onAddComment: () => void;
}

export const FloatingCommentButton: React.FC<FloatingCommentButtonProps> = ({
  selection,
  onAddComment,
}) => {
  if (!selection || !selection.coords || !selection.text) return null;

  return (
    <div
      style={{
        top: `${selection.coords.top - 42}px`,
        left: `${selection.coords.left + 8}px`,
      }}
      className="fixed z-50 flex items-center bg-slate-900 text-white shadow-xl rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer hover:bg-slate-800 transition transform -translate-y-1 animate-in fade-in duration-150 border border-slate-700"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onAddComment();
      }}
    >
      <MessageSquarePlus className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
      <span>Add comment</span>
    </div>
  );
};
