import React, { useCallback, useEffect, useState } from "react";
import {
  X,
  LayoutTemplate,
  RefreshCw,
  FileText,
  Braces,
  FolderOpen,
} from "lucide-react";
import {
  BUILT_IN_TEMPLATES,
  DocumentTemplate,
  SNIPPETS,
  listOrganizationTemplates,
} from "../../services/templates";

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templatesFolderId: string;
  onCreateFromTemplate: (template: DocumentTemplate) => Promise<void>;
  onInsertSnippet: (content: string) => void;
}

type Tab = "templates" | "snippets";

/**
 * New documents from templates, and reusable snippets with variables.
 */
export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  templatesFolderId,
  onCreateFromTemplate,
  onInsertSnippet,
}) => {
  const [tab, setTab] = useState<Tab>("templates");
  const [orgTemplates, setOrgTemplates] = useState<DocumentTemplate[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const loadOrgTemplates = useCallback(async () => {
    if (!templatesFolderId) {
      setOrgTemplates([]);
      setOrgError(null);
      return;
    }
    setOrgLoading(true);
    setOrgError(null);
    try {
      const templates = await listOrganizationTemplates(templatesFolderId);
      setOrgTemplates(templates);
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : "Unknown error");
      setOrgTemplates([]);
    } finally {
      setOrgLoading(false);
    }
  }, [templatesFolderId]);

  useEffect(() => {
    if (isOpen) {
      void loadOrgTemplates();
    }
  }, [isOpen, loadOrgTemplates]);

  if (!isOpen) return null;

  const applyTemplate = async (template: DocumentTemplate) => {
    if (creatingId) return;
    setCreatingId(template.id);
    try {
      await onCreateFromTemplate(template);
      onClose();
    } catch {
      // Creation errors surface through the save status in the header.
    } finally {
      setCreatingId(null);
    }
  };

  const renderCard = (template: DocumentTemplate) => (
    <button
      key={template.id}
      onClick={() => void applyTemplate(template)}
      disabled={creatingId !== null}
      className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-950/20 transition disabled:opacity-50"
    >
      <div className="flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
          {template.name}
        </span>
      </div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
        {template.description}
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Templates and snippets
            </h3>
          </div>
          <button
            onClick={onClose}
            title="Close templates"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => setTab("templates")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              tab === "templates"
                ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setTab("snippets")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              tab === "snippets"
                ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Snippets
          </button>
        </div>

        <div className="p-3 overflow-y-auto flex-1 space-y-1.5">
          {tab === "templates" ? (
            <>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 pt-1">
                Built-in
              </div>
              {BUILT_IN_TEMPLATES.map(renderCard)}

              {templatesFolderId && (
                <>
                  <div className="flex items-center justify-between px-1 pt-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      Organization
                    </span>
                    <button
                      onClick={() => void loadOrgTemplates()}
                      title="Refresh organization templates"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${orgLoading ? "animate-spin" : ""}`}
                      />
                    </button>
                  </div>
                  {orgError && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 px-2 py-2">
                      Could not load organization templates: {orgError}
                    </div>
                  )}
                  {!orgError && orgLoading && orgTemplates.length === 0 && (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      Loading organization templates...
                    </div>
                  )}
                  {!orgError && !orgLoading && orgTemplates.length === 0 && (
                    <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-slate-400">
                      <FolderOpen className="w-4 h-4 shrink-0" />
                      <span>No Markdown files in the configured folder.</span>
                    </div>
                  )}
                  {orgTemplates.map(renderCard)}
                </>
              )}
            </>
          ) : (
            SNIPPETS.map((snippet) => (
              <button
                key={snippet.id}
                onClick={() => {
                  onInsertSnippet(snippet.content);
                  onClose();
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-950/20 transition"
              >
                <div className="flex items-center gap-2">
                  <Braces className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {snippet.name}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {snippet.description}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
