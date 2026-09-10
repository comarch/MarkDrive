import React, { useState, useRef, useEffect } from "react";
import {
  Save,
  FilePlus,
  FolderOpen,
  FileCog,
  Download,
  ListTree,
  History,
  MessageSquare,
  Moon,
  Sun,
  Settings,
  LogIn,
  LogOut,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  PenLine,
  FilePen,
  ListChecks,
  LayoutTemplate,
  Network,
} from "lucide-react";
import { DriveUser, SaveStatus, DriveFileMetadata } from "../../types/drive";
import {
  reviewStatusLabel,
  reviewStatusClasses,
} from "../../utils/reviewStatus";

export type EditingMode = "edit" | "suggest";

// Brand assets live in the public directory, so they follow the deployment base
// path instead of the site root.
const baseUrl = (import.meta as unknown as { env: { BASE_URL: string } }).env
  .BASE_URL;

interface AppHeaderProps {
  documentTitle: string;
  onChangeTitle: (title: string) => void;
  saveStatus: SaveStatus;
  editingMode: EditingMode;
  onChangeEditingMode: (mode: EditingMode) => void;
  reviewStatus: string | null;
  onOpenReviewQueue?: () => void;
  onOpenTemplates?: () => void;
  onOpenGraph?: () => void;
  user: DriveUser | null;
  fileMetadata: DriveFileMetadata | null;
  isDark: boolean;
  onToggleTheme: () => void;
  onSave: () => void;
  onNewDocument: () => void;
  onOpenFileBrowser?: () => void;
  onOpenExportModal: () => void;
  onToggleOutline: () => void;
  isOutlineOpen: boolean;
  onOpenHistory?: () => void;
  isHistoryOpen?: boolean;
  onOpenProperties?: () => void;
  onToggleComments: () => void;
  isCommentsOpen: boolean;
  openCommentsCount: number;
  onOpenSettings: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  documentTitle,
  onChangeTitle,
  saveStatus,
  editingMode,
  onChangeEditingMode,
  reviewStatus,
  onOpenReviewQueue,
  onOpenTemplates,
  onOpenGraph,
  user,
  fileMetadata,
  isDark,
  onToggleTheme,
  onSave,
  onNewDocument,
  onOpenFileBrowser,
  onOpenExportModal,
  onToggleOutline,
  isOutlineOpen,
  onOpenHistory,
  isHistoryOpen = false,
  onOpenProperties,
  onToggleComments,
  isCommentsOpen,
  openCommentsCount,
  onOpenSettings,
  onSignIn,
  onSignOut,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(documentTitle);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleInput(documentTitle);
  }, [documentTitle]);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onChangeTitle(titleInput.trim());
    } else {
      setTitleInput(documentTitle);
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between no-print z-40 select-none">
      {/* Left: App Logo & Document Title */}
      <div className="flex items-center gap-3">
        {/* Product logo */}
        <div className="flex items-center">
          <img
            src={`${baseUrl}logo.svg`}
            alt="Comarch MarkQuire"
            className="w-8 h-8 md:hidden"
          />
          <img
            src={`${baseUrl}brand/comarch-markquire.svg`}
            alt="Comarch MarkQuire"
            className="hidden md:block dark:hidden w-[138px] h-9"
          />
          <img
            src={`${baseUrl}brand/comarch-markquire-dark.svg`}
            alt="Comarch MarkQuire"
            className="hidden dark:md:block w-[138px] h-9"
          />
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

        {/* Title & Save status */}
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSubmit();
                if (e.key === "Escape") {
                  setTitleInput(documentTitle);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="text-sm font-semibold px-2 py-1 rounded border border-brand-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          ) : (
            <span
              onClick={() => setIsEditingTitle(true)}
              title="Click to rename document"
              className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded cursor-pointer transition max-w-[200px] sm:max-w-xs md:max-w-md truncate"
            >
              {documentTitle}
            </span>
          )}

          {/* Review status pill from the frontmatter field */}
          {reviewStatus && (
            <span
              title={`Review status: ${reviewStatusLabel(reviewStatus)}`}
              className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${reviewStatusClasses(reviewStatus)}`}
            >
              {reviewStatusLabel(reviewStatus)}
            </span>
          )}

          {/* Drive file link if opened from Google Drive */}
          {fileMetadata?.webViewLink && (
            <a
              href={fileMetadata.webViewLink}
              target="_blank"
              rel="noreferrer"
              title="Open file in Google Drive"
              className="text-slate-400 hover:text-brand-600 transition p-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Save Status Indicator */}
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 ml-1">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-brand-600 dark:text-brand-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Saving to Drive...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Saved</span>
              </span>
            )}
            {saveStatus === "unsaved" && (
              <span className="flex items-center gap-1 text-amber-500">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="hidden sm:inline">Unsaved</span>
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1 text-rose-500">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save failed</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Editing mode switch: direct edits or recorded suggestions */}
      <div
        className="hidden md:flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 gap-0.5"
        role="radiogroup"
        aria-label="Editing mode"
      >
        <button
          onClick={() => onChangeEditingMode("edit")}
          title="Edit the document directly"
          aria-pressed={editingMode === "edit"}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition ${
            editingMode === "edit"
              ? "bg-brand-600 text-white"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <PenLine className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
        <button
          onClick={() => onChangeEditingMode("suggest")}
          title="Record changes as suggestions for review"
          aria-pressed={editingMode === "suggest"}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition ${
            editingMode === "suggest"
              ? "bg-amber-500 text-white"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <FilePen className="w-3.5 h-3.5" />
          <span>Suggest</span>
        </button>
      </div>

      {/* Right Actions Toolbar */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* New document button */}
        <button
          onClick={onNewDocument}
          title="New document (Create in Drive)"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
        >
          <FilePlus className="w-4 h-4" />
        </button>

        {/* Open recent Markdown files button */}
        {onOpenFileBrowser && (
          <button
            onClick={onOpenFileBrowser}
            title="Open Markdown files"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        )}

        {/* Save button */}
        <button
          onClick={onSave}
          title="Save to Google Drive (Ctrl + S)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition shadow-xs"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Save</span>
        </button>

        {/* Export button */}
        <button
          onClick={onOpenExportModal}
          title="Export (Markdown, HTML, PDF)"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
        >
          <Download className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* Outline / TOC button */}
        <button
          onClick={onToggleOutline}
          title="Toggle document outline"
          className={`p-1.5 rounded-lg transition ${
            isOutlineOpen
              ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400"
              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          }`}
        >
          <ListTree className="w-4 h-4" />
        </button>

        {/* Templates and snippets button */}
        {onOpenTemplates && (
          <button
            onClick={onOpenTemplates}
            title="Templates and snippets"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <LayoutTemplate className="w-4 h-4" />
          </button>
        )}

        {/* Folder link graph button */}
        {onOpenGraph && (
          <button
            onClick={onOpenGraph}
            title="Folder link graph"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <Network className="w-4 h-4" />
          </button>
        )}

        {/* Review queue button */}
        {onOpenReviewQueue && (
          <button
            onClick={onOpenReviewQueue}
            title="Documents awaiting review"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <ListChecks className="w-4 h-4" />
          </button>
        )}

        {/* Drive version history button */}
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            title="Version history"
            className={`p-1.5 rounded-lg transition ${
              isHistoryOpen
                ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400"
                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
          >
            <History className="w-4 h-4" />
          </button>
        )}

        {/* Frontmatter properties button */}
        {onOpenProperties && (
          <button
            onClick={onOpenProperties}
            title="Document properties"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <FileCog className="w-4 h-4" />
          </button>
        )}

        {/* Google Drive Comments Drawer Button */}
        <button
          onClick={onToggleComments}
          title="Google Drive comments"
          className={`relative p-1.5 rounded-lg transition ${
            isCommentsOpen
              ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          {openCommentsCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full text-[9px] font-bold bg-amber-500 text-white flex items-center justify-center">
              {openCommentsCount}
            </span>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Settings & Google OAuth Config"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Google User Menu / Login */}
        <div className="relative" ref={userMenuRef}>
          {user ? (
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 p-1 rounded-full hover:ring-2 hover:ring-slate-300 transition"
            >
              {user.photoLink ? (
                <img
                  src={user.photoLink}
                  alt={user.displayName}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
                  {user.displayName.charAt(0)}
                </div>
              )}
            </button>
          ) : (
            <button
              onClick={onSignIn}
              title="Connect Google Drive"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition"
            >
              <LogIn className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}

          {/* User Dropdown */}
          {showUserMenu && user && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-50 animate-in fade-in duration-100">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {user.displayName}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {user.emailAddress}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onSignOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect Google Drive</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
