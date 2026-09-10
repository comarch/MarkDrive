import React from "react";
import { X, FileText, Globe, Printer, Download } from "lucide-react";
import {
  exportAsMarkdown,
  exportAsHtml,
  exportAsPdf,
} from "../../utils/exportUtils";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  markdownContent: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  markdownContent,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Export Document
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Option 1: Markdown file */}
          <div
            onClick={() => {
              exportAsMarkdown(documentTitle, markdownContent);
              onClose();
            }}
            className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 cursor-pointer transition"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Markdown (.md)
              </div>
              <div className="text-xs text-slate-500">
                Download raw markdown file to your local computer
              </div>
            </div>
          </div>

          {/* Option 2: Styled HTML */}
          <div
            onClick={() => {
              void exportAsHtml(documentTitle, markdownContent);
              onClose();
            }}
            className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 cursor-pointer transition"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Styled HTML (.html)
              </div>
              <div className="text-xs text-slate-500">
                Self-contained HTML with math, code, and fonts inlined
              </div>
            </div>
          </div>

          {/* Option 3: Print / PDF */}
          <div
            onClick={() => {
              onClose();
              setTimeout(() => exportAsPdf(), 200);
            }}
            className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 cursor-pointer transition"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Print or Save to PDF
              </div>
              <div className="text-xs text-slate-500">
                Open browser print dialog optimized for clean document export
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
