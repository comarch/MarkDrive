import React, { useState } from "react";
import { X, FileText, RefreshCw, Search } from "lucide-react";
import { DriveFileMetadata } from "../../types/drive";
import {
  searchCompanion,
  type CompanionSearchHit,
} from "../../services/companion";
import { t } from "../../i18n";

interface FileBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: DriveFileMetadata[];
  loading: boolean;
  error: string | null;
  onSelect: (fileId: string) => void;
  onRefresh: () => void;
  /** Companion base URL; when set, organization search is offered. */
  companionUrl?: string;
}

function formatModifiedTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Recent Markdown files. Drive's drive.file scope only shows files this app
 * created or opened, so untouched files stay reachable through Drive itself.
 * With a companion configured, the organization search index is queried too.
 */
export const FileBrowserModal: React.FC<FileBrowserModalProps> = ({
  isOpen,
  onClose,
  files,
  loading,
  error,
  onSelect,
  onRefresh,
  companionUrl,
}) => {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CompanionSearchHit[] | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);

  if (!isOpen) return null;

  const runSearch = async () => {
    if (!companionUrl || query.trim().length === 0) return;
    setSearching(true);
    setSearchFailed(false);
    const response = await searchCompanion(companionUrl, query.trim());
    setSearching(false);
    if (response === null) {
      setResults(null);
      setSearchFailed(true);
      return;
    }
    setResults(response.results);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Markdown files
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              title="Refresh file list"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Organization search through the companion index */}
        {companionUrl && (
          <div className="p-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                placeholder={t("search.placeholder")}
                aria-label={t("search.title")}
                className="flex-1 text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
              <button
                onClick={() => void runSearch()}
                disabled={searching || query.trim().length === 0}
                className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium"
              >
                {t("search.run")}
              </button>
            </div>
            {searchFailed && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                {t("search.unavailable")}
              </p>
            )}
            {results !== null && results.length === 0 && !searchFailed && (
              <p className="mt-2 text-[11px] text-slate-400">
                {t("search.none")}
              </p>
            )}
            {results !== null &&
              results.map((hit) => (
                <button
                  key={hit.fileId}
                  onClick={() => {
                    setResults(null);
                    setQuery("");
                    onSelect(hit.fileId);
                  }}
                  className="w-full text-left px-3 py-2 mt-1 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <div className="text-xs font-medium truncate">{hit.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {hit.snippet}
                  </div>
                </button>
              ))}
          </div>
        )}

        <div className="p-3 overflow-y-auto flex-1 space-y-1">
          {error && (
            <div className="text-xs text-rose-600 dark:text-rose-400 px-2 py-3">
              Could not load files: {error}
            </div>
          )}

          {!error && loading && files.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-xs">
              Loading files...
            </div>
          )}

          {!error && !loading && files.length === 0 && (
            <div className="text-center py-6 px-3 text-slate-400 text-xs">
              No Markdown files yet. Files appear here after this app creates or
              opens them. For files never touched by MarkQuire, open them from
              Google Drive once.
            </div>
          )}

          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => onSelect(file.id)}
              className="w-full text-left px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <div className="text-xs font-medium truncate">{file.name}</div>
              <div className="text-[11px] text-slate-400 truncate">
                {formatModifiedTime(file.modifiedTime) || "Not opened yet"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
