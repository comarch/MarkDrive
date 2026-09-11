import React from "react";
import {
  X,
  FileText,
  Globe,
  Printer,
  Download,
  FolderArchive,
  FileDown,
  CloudUpload,
} from "lucide-react";
import {
  exportAsMarkdown,
  exportAsHtml,
  exportAsPdf,
  exportAsDocx,
} from "../../utils/exportUtils";
import { t } from "../../i18n";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  markdownContent: string;
  onExportStaticSite?: () => void;
  onExportGoogleDocs?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  markdownContent,
  onExportStaticSite,
  onExportGoogleDocs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t("export.title")}
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
          <button
            type="button"
            onClick={() => {
              exportAsMarkdown(documentTitle, markdownContent);
              onClose();
            }}
            className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 cursor-pointer transition w-full text-left bg-transparent"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t("export.markdown")}
              </div>
              <div className="text-xs text-slate-500">
                {t("export.markdownDesc")}
              </div>
            </div>
          </button>

          {/* Option 2: Styled HTML */}
          <button
            type="button"
            onClick={() => {
              void exportAsHtml(documentTitle, markdownContent);
              onClose();
            }}
            className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 cursor-pointer transition w-full text-left bg-transparent"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t("export.html")}
              </div>
              <div className="text-xs text-slate-500">
                {t("export.htmlDesc")}
              </div>
            </div>
          </button>

          {/* Option 3: Word document */}
          <button
            type="button"
            onClick={() => {
              exportAsDocx(documentTitle, markdownContent);
              onClose();
            }}
            className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 cursor-pointer transition w-full text-left bg-transparent"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center shrink-0">
              <FileDown className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t("export.docx")}
              </div>
              <div className="text-xs text-slate-500">
                {t("export.docxDesc")}
              </div>
            </div>
          </button>

          {/* Option 4: Google Docs conversion in Drive */}
          {onExportGoogleDocs && (
            <button
              type="button"
              onClick={() => {
                void onExportGoogleDocs();
                onClose();
              }}
              className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 cursor-pointer transition w-full text-left bg-transparent"
            >
              <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 flex items-center justify-center shrink-0">
                <CloudUpload className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t("export.gdocs")}
                </div>
                <div className="text-xs text-slate-500">
                  {t("export.gdocsDesc")}
                </div>
              </div>
            </button>
          )}

          {/* Option 5: Static site from the Drive folder */}
          {onExportStaticSite && (
            <button
              type="button"
              onClick={() => {
                void onExportStaticSite();
                onClose();
              }}
              className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 cursor-pointer transition w-full text-left bg-transparent"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 flex items-center justify-center shrink-0">
                <FolderArchive className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t("export.site")}
                </div>
                <div className="text-xs text-slate-500">
                  {t("export.siteDesc")}
                </div>
              </div>
            </button>
          )}

          {/* Option 6: Print / PDF */}
          <button
            type="button"
            onClick={() => {
              onClose();
              setTimeout(() => exportAsPdf(), 200);
            }}
            className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 cursor-pointer transition w-full text-left bg-transparent"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t("export.pdf")}
              </div>
              <div className="text-xs text-slate-500">
                {t("export.pdfDesc")}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
