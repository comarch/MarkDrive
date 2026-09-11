import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { AppHeader, type EditingMode } from "./components/Header/AppHeader";
import { EditorToolbar } from "./components/Editor/EditorToolbar";
import {
  CodeMirrorEditor,
  CodeMirrorEditorHandle,
} from "./components/Editor/CodeMirrorEditor";
import { FloatingCommentButton } from "./components/Editor/FloatingCommentButton";
import {
  MarkdownPreview,
  MarkdownPreviewHandle,
  extractOutline,
} from "./components/Preview/MarkdownPreview";
import { CommentsSidebar } from "./components/Comments/CommentsSidebar";
import { NewCommentModal } from "./components/Comments/NewCommentModal";
import { SettingsModal } from "./components/Modals/SettingsModal";
import { ExportModal } from "./components/Modals/ExportModal";
import { InsertTableModal } from "./components/Modals/InsertTableModal";
import { OutlineSidebar } from "./components/Modals/OutlineSidebar";
import { ConflictModal } from "./components/Modals/ConflictModal";
import { HistorySidebar } from "./components/Modals/HistorySidebar";
import { FileBrowserModal } from "./components/Modals/FileBrowserModal";
import { PropertiesPanel } from "./components/Editor/PropertiesPanel";
import { TableToolbar } from "./components/Editor/TableToolbar";
import { ReviewQueueModal } from "./components/Modals/ReviewQueueModal";
import { TemplatesModal } from "./components/Modals/TemplatesModal";
import {
  expandTemplateVariables,
  type DocumentTemplate,
} from "./services/templates";

import { authService } from "./services/googleAuth";
import { driveService } from "./services/googleDrive";
import { commentsService } from "./services/googleComments";
import {
  parseDriveStateFromUrl,
  updateUrlFileId,
  parseLineAnchorFromUrl,
} from "./services/driveState";
import { SAMPLE_MARKDOWN } from "./utils/sampleDocument";
import { toggleTaskLine } from "./utils/tasks";
import { parseFrontmatter, updateFrontmatterField } from "./utils/frontmatter";
import { REVIEW_STATUS_FIELD } from "./utils/reviewStatus";
import { applyTableAction, type TableAction } from "./utils/tableUtils";
import {
  applySuggestionHunks,
  buildSuggestionHunks,
  parseSuggestions,
  serializeSuggestions,
} from "./utils/patch";
import type { TableCursorContext } from "./components/Editor/CodeMirrorEditor";

import {
  DriveUser,
  DriveFileMetadata,
  SaveStatus,
  DriveComment,
  DriveRevision,
} from "./types/drive";
import {
  ViewMode,
  SelectionInfo,
  AppSettings,
  OutlineItem,
} from "./types/editor";

const DEFAULT_SETTINGS: AppSettings = {
  googleClientId: authService.getClientId(),
  autoSaveIntervalMs: 2000,
  theme: "system",
  fontSize: 14,
  syncScroll: true,
  templatesFolderId: "",
};

const LOCAL_STORAGE_CONTENT_KEY = "gdrive_md_last_content";
const LOCAL_STORAGE_TITLE_KEY = "gdrive_md_last_title";
const LOCAL_STORAGE_SETTINGS_KEY = "gdrive_md_settings";

export const App: React.FC = () => {
  // Application Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      return stored
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Dark Mode
  const [isDark, setIsDark] = useState<boolean>(() => {
    return (
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  // Document State
  const [documentTitle, setDocumentTitle] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_TITLE_KEY) || "Welcome.md";
  });
  const [content, setContent] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_CONTENT_KEY) || SAMPLE_MARKDOWN;
  });
  const [fileMetadata, setFileMetadata] = useState<DriveFileMetadata | null>(
    null,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  // Google User
  const [user, setUser] = useState<DriveUser | null>(
    authService.getCurrentUser(),
  );

  // Comments
  const [comments, setComments] = useState<DriveComment[]>([]);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null,
  );
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isNewCommentModalOpen, setIsNewCommentModalOpen] = useState(false);

  // Outline
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);

  // Other Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  // Save conflict detected when Drive moved ahead of this session
  const [conflict, setConflict] = useState<{
    baseContent: string;
    remoteContent: string;
  } | null>(null);

  // Drive version history
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRevisions, setHistoryRevisions] = useState<DriveRevision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySelectedId, setHistorySelectedId] = useState<string | null>(
    null,
  );
  const [historySelectedContent, setHistorySelectedContent] = useState<
    string | null
  >(null);

  // Recent Markdown files browser
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);
  const [fileBrowserFiles, setFileBrowserFiles] = useState<DriveFileMetadata[]>(
    [],
  );
  const [fileBrowserLoading, setFileBrowserLoading] = useState(false);
  const [fileBrowserError, setFileBrowserError] = useState<string | null>(null);

  // Frontmatter properties panel
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);

  // Review workflow: queue modal and passage deep link anchor
  const [isReviewQueueOpen, setIsReviewQueueOpen] = useState(false);
  // Templates and snippets modal
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  // Passage deep link (#line=N), parsed once on mount.
  const [lineAnchor] = useState<number | null>(() => parseLineAnchorFromUrl());
  const lineAnchorAppliedRef = useRef(false);

  // Table context toolbar
  const [tableContext, setTableContext] = useState<TableCursorContext | null>(
    null,
  );

  // Editor Selection & View Mode
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  // Suggestion mode: edits are recorded as a patch, not written to Drive.
  const [editingMode, setEditingMode] = useState<EditingMode>("edit");
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  // Document text the suggester started from; null outside suggest mode.
  const [suggestionBase, setSuggestionBase] = useState<string | null>(null);

  // Component Refs
  const editorRef = useRef<CodeMirrorEditorHandle>(null);
  const previewRef = useRef<MarkdownPreviewHandle>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Content last synced with Drive; acts as the base for conflict merges.
  const lastSyncedContentRef = useRef<string>(content);
  // Suppresses auto-save while the conflict dialog is open.
  const isConflictOpenRef = useRef(false);
  // Resolved cross-document links, cached per session folder and file name.
  const docLinkCacheRef = useRef(new Map<string, string | null>());

  // Leaves suggestion mode without a dialog when the document is about to
  // be replaced wholesale (open, restore, conflict, new document).
  const exitSuggestModeSilently = useCallback(() => {
    setEditingMode("edit");
    setSuggestionError(null);
    setSuggestionBase(null);
  }, []);

  // Passage deep link: scroll the editor to the linked line once the
  // document text is available.
  useEffect(() => {
    if (lineAnchor === null || lineAnchorAppliedRef.current) return;
    if (content.length === 0) return;
    lineAnchorAppliedRef.current = true;
    editorRef.current?.scrollToLine(lineAnchor);
  }, [lineAnchor, content]);

  // Sync theme with DOM
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // Subscribe to Google Auth changes
  useEffect(() => {
    const unsubscribe = authService.subscribe(() => {
      setUser(authService.getCurrentUser());
    });
    return unsubscribe;
  }, []);

  // Load comments for active file
  const loadComments = useCallback(async (fileId: string) => {
    try {
      const list = await commentsService.listComments(fileId);
      setComments(list);
    } catch (err) {
      console.warn("Failed to load Google Drive comments:", err);
    }
  }, []);

  // Initialize from Google Drive URL state (New or Open)
  useEffect(() => {
    const driveState = parseDriveStateFromUrl();
    if (!driveState) {
      // Standalone load
      const mockFileId = "local_draft";
      loadComments(mockFileId);
      return;
    }

    const initDrive = async () => {
      setSaveStatus("saving");
      try {
        if (
          driveState.action === "open" &&
          driveState.ids &&
          driveState.ids.length > 0
        ) {
          const fileId = driveState.ids[0];
          if (!fileId) {
            throw new Error("Google Drive did not provide a file ID.");
          }
          const result = await driveService.getFile(fileId);
          setFileMetadata(result.metadata);
          setDocumentTitle(result.metadata.name);
          setContent(result.content);
          lastSyncedContentRef.current = result.content;
          setSaveStatus("saved");
          updateUrlFileId(fileId);
          await loadComments(fileId);
        } else if (driveState.action === "create") {
          // Create new file in specified folder
          const created = await driveService.createFile(
            "Untitled.md",
            SAMPLE_MARKDOWN,
            driveState.folderId,
          );
          setFileMetadata(created);
          setDocumentTitle(created.name);
          setContent(SAMPLE_MARKDOWN);
          lastSyncedContentRef.current = SAMPLE_MARKDOWN;
          setSaveStatus("saved");
          updateUrlFileId(created.id);
          await loadComments(created.id);
        }
      } catch (err) {
        console.error("Error handling Drive state:", err);
        setSaveStatus("error");
      }
    };

    initDrive();
  }, [loadComments]);

  // Save document to Google Drive / LocalStorage
  const handleSaveDocument = useCallback(async () => {
    if (isConflictOpenRef.current) return; // resolve the open conflict first
    setSaveStatus("saving");
    try {
      if (fileMetadata) {
        // Detect concurrent edits: compare the Drive head revision with the
        // revision this session last synced from.
        const knownHead = fileMetadata.headRevisionId;
        let remoteHead: string | null = null;
        try {
          remoteHead = await driveService.fetchHeadRevisionId(fileMetadata.id);
        } catch {
          // The revision check is best effort; the update call still reports
          // hard failures.
        }
        if (knownHead && remoteHead && knownHead !== remoteHead) {
          const remote = await driveService.getFile(fileMetadata.id);
          setConflict({
            baseContent: lastSyncedContentRef.current,
            remoteContent: remote.content,
          });
          isConflictOpenRef.current = true;
          setSaveStatus("unsaved");
          return;
        }
        const updated = await driveService.updateFile(
          fileMetadata.id,
          content,
          documentTitle,
        );
        // Merge instead of replace: update responses omit fields like
        // parents, and losing them would misplace later image uploads.
        setFileMetadata((prev) => (prev ? { ...prev, ...updated } : updated));
        lastSyncedContentRef.current = content;
      } else {
        // Save draft locally
        localStorage.setItem(LOCAL_STORAGE_CONTENT_KEY, content);
        localStorage.setItem(LOCAL_STORAGE_TITLE_KEY, documentTitle);
      }
      setSaveStatus("saved");
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus("error");
    }
  }, [content, documentTitle, fileMetadata]);

  // Auto-save timers must call the latest save handler; a plain closure
  // would capture stale content from the render that scheduled the timer.
  const saveDocumentRef = useRef(handleSaveDocument);
  useEffect(() => {
    saveDocumentRef.current = handleSaveDocument;
  }, [handleSaveDocument]);

  // Write the resolved content from the conflict dialog to Drive
  const handleResolveConflict = useCallback(
    async (resolvedContent: string) => {
      if (!fileMetadata) return;
      exitSuggestModeSilently();
      setConflict(null);
      isConflictOpenRef.current = false;
      setSaveStatus("saving");
      try {
        const updated = await driveService.updateFile(
          fileMetadata.id,
          resolvedContent,
          documentTitle,
        );
        setFileMetadata((prev) => (prev ? { ...prev, ...updated } : updated));
        setContent(resolvedContent);
        localStorage.setItem(LOCAL_STORAGE_CONTENT_KEY, resolvedContent);
        lastSyncedContentRef.current = resolvedContent;
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save merged content:", err);
        setSaveStatus("error");
      }
    },
    [documentTitle, exitSuggestModeSilently, fileMetadata],
  );

  // Dismiss the conflict dialog without saving
  const handleDismissConflict = useCallback(() => {
    setConflict(null);
    isConflictOpenRef.current = false;
    setSaveStatus("unsaved");
  }, []);

  // Load the revision list for the open Drive file
  const loadHistory = useCallback(async (fileId: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const revisions = await driveService.listRevisions(fileId);
      setHistoryRevisions(revisions);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Unknown error");
      setHistoryRevisions([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleOpenHistory = useCallback(async () => {
    setIsHistoryOpen(true);
    setHistorySelectedId(null);
    setHistorySelectedContent(null);
    if (fileMetadata) {
      await loadHistory(fileMetadata.id);
    }
  }, [fileMetadata, loadHistory]);

  const handleSelectRevision = useCallback(
    async (revisionId: string) => {
      if (!fileMetadata) return;
      // Only revisions from the loaded history can be previewed, so the id
      // is always one Drive returned and never an arbitrary string.
      if (!historyRevisions.some((revision) => revision.id === revisionId)) {
        setHistoryError("Unknown revision");
        return;
      }
      setHistorySelectedId(revisionId);
      setHistorySelectedContent(null);
      setHistoryError(null);
      try {
        const revisionContent = await driveService.getRevisionContent(
          fileMetadata.id,
          revisionId,
        );
        setHistorySelectedContent(revisionContent);
      } catch (err) {
        setHistoryError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [fileMetadata, historyRevisions],
  );

  const handleRestoreRevision = useCallback(
    async (revisionId: string) => {
      if (!fileMetadata) return;
      // Restoring accepts only ids from the loaded revision list.
      if (!historyRevisions.some((revision) => revision.id === revisionId)) {
        setHistoryError("Unknown revision");
        return;
      }
      if (saveStatus === "unsaved") {
        const confirmRestore = window.confirm(
          "You have unsaved changes. Restore the selected version anyway?",
        );
        if (!confirmRestore) return;
      }
      // Restoring replaces the document; pending suggestions cannot apply.
      exitSuggestModeSilently();
      try {
        // restoreRevision writes the selected content to Drive as a new
        // revision, then we mirror it locally.
        await driveService.restoreRevision(fileMetadata.id, revisionId);
        const restored = await driveService.getFile(fileMetadata.id);
        setFileMetadata((prev) =>
          prev ? { ...prev, ...restored.metadata } : restored.metadata,
        );
        setContent(restored.content);
        // The local draft cache is not written here: the restored text comes
        // straight from Drive, and the cache refreshes on the next edit.
        lastSyncedContentRef.current = restored.content;
        setSaveStatus("saved");
        await loadHistory(fileMetadata.id);
        setHistorySelectedId(null);
        setHistorySelectedContent(null);
      } catch (err) {
        console.error("Failed to restore revision:", err);
        setHistoryError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [
      exitSuggestModeSilently,
      fileMetadata,
      historyRevisions,
      loadHistory,
      saveStatus,
    ],
  );

  // Load the recent Markdown file list
  const loadFileList = useCallback(async () => {
    setFileBrowserLoading(true);
    setFileBrowserError(null);
    try {
      const files = await driveService.listMarkdownFiles();
      setFileBrowserFiles(files);
    } catch (err) {
      setFileBrowserError(err instanceof Error ? err.message : "Unknown error");
      setFileBrowserFiles([]);
    } finally {
      setFileBrowserLoading(false);
    }
  }, []);

  const handleOpenFileBrowser = useCallback(async () => {
    setIsFileBrowserOpen(true);
    await loadFileList();
  }, [loadFileList]);

  // Switch to another Drive document without leaving the app
  const handleOpenFile = useCallback(
    async (fileId: string) => {
      if (saveStatus === "unsaved") {
        const confirmSwitch = window.confirm(
          "You have unsaved changes. Open another file anyway?",
        );
        if (!confirmSwitch) return;
      }
      // The new document replaces the text; suggestions do not carry over.
      exitSuggestModeSilently();
      setSaveStatus("saving");
      try {
        const result = await driveService.getFile(fileId);
        setFileMetadata(result.metadata);
        setDocumentTitle(result.metadata.name);
        setContent(result.content);
        lastSyncedContentRef.current = result.content;
        // The draft cache is not written here: opened Drive content stays out
        // of local storage until the user edits, which refreshes the cache.
        setSaveStatus("saved");
        setIsFileBrowserOpen(false);
        updateUrlFileId(fileId);
        setSelectedCommentId(null);
        setComments([]);
        await loadComments(fileId);
      } catch (err) {
        console.error("Failed to open file:", err);
        setSaveStatus("error");
      }
    },
    [exitSuggestModeSilently, loadComments, saveStatus],
  );

  // Resolve a relative Markdown link against the document's Drive folder
  const handleOpenDocLink = useCallback(
    async (target: string) => {
      const name = target.split("#")[0] ?? target;
      if (!name) return;
      const folderId = fileMetadata?.parents?.[0];
      if (!folderId) {
        window.alert(
          "Cross-document links need a file opened from a Drive folder.",
        );
        return;
      }
      const cacheKey = `${folderId}/${name}`;
      let fileId: string | null | undefined =
        docLinkCacheRef.current.get(cacheKey);
      if (fileId === undefined) {
        try {
          fileId = await driveService.findFileInFolder(name, folderId);
          docLinkCacheRef.current.set(cacheKey, fileId);
        } catch (err) {
          console.error("Failed to resolve document link:", err);
          window.alert("Could not resolve the linked file. Check the folder.");
          return;
        }
      }
      if (!fileId) {
        window.alert(`No file named "${name}" exists in the document folder.`);
        return;
      }
      await handleOpenFile(fileId);
    },
    [fileMetadata, handleOpenFile],
  );

  // Handle document content change & auto-save
  const handleContentChange = (newContent: string) => {
    setContent(newContent);

    // In suggestion mode the edit is a proposal: keep it in the editor
    // only, never in the draft cache or the autosave pipeline.
    if (editingMode === "suggest") return;

    setSaveStatus("unsaved");
    try {
      localStorage.setItem(LOCAL_STORAGE_CONTENT_KEY, newContent);
    } catch {
      // Draft persistence is best effort; keep editing when the quota is full.
    }

    if (settings.autoSaveIntervalMs > 0) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        saveDocumentRef.current();
      }, settings.autoSaveIntervalMs);
    }
  };

  // Pending suggestion hunks, shown in the suggestion banner.
  const pendingSuggestionHunks = useMemo(
    () =>
      editingMode === "suggest" && suggestionBase !== null
        ? buildSuggestionHunks(suggestionBase, content)
        : [],
    [editingMode, suggestionBase, content],
  );

  const handleEditingModeChange = (mode: EditingMode) => {
    if (mode === editingMode) return;

    if (mode === "suggest") {
      // A pending autosave must not fire while suggestions accumulate.
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      setSuggestionBase(content);
      setSuggestionError(null);
      setEditingMode("suggest");
      return;
    }

    const hasPending = suggestionBase !== null && content !== suggestionBase;
    if (hasPending && suggestionBase !== null) {
      const confirmDiscard = window.confirm(
        "Discard unsubmitted suggestions and return to direct editing?",
      );
      if (!confirmDiscard) return;
      setContent(suggestionBase);
    }
    exitSuggestModeSilently();
  };

  const handleSubmitSuggestions = async () => {
    if (suggestionBase === null) return;
    const hunks = buildSuggestionHunks(suggestionBase, content);
    if (hunks.length === 0) {
      exitSuggestModeSilently();
      return;
    }

    const firstHunk = hunks[0];
    const quotedText =
      firstHunk && firstHunk.contextBefore.length > 0
        ? firstHunk.contextBefore[firstHunk.contextBefore.length - 1]
        : undefined;
    const anchorLine = firstHunk ? firstHunk.anchorLine + 1 : undefined;

    const fileId = fileMetadata?.id || "local_draft";
    try {
      const newComment = await commentsService.createComment(
        fileId,
        serializeSuggestions(hunks),
        quotedText,
        anchorLine,
      );
      setComments((prev) => [newComment, ...prev]);
      setContent(suggestionBase);
      exitSuggestModeSilently();
      setIsCommentsOpen(true);
      setSelectedCommentId(newComment.id);
    } catch (err) {
      console.error("Failed to submit suggestions:", err);
      setSuggestionError(
        "Submitting suggestions failed. Check your connection and try again.",
      );
    }
  };

  const handleDiscardSuggestions = () => {
    if (suggestionBase !== null) setContent(suggestionBase);
    exitSuggestModeSilently();
  };

  // Applies one hunk from a suggestion comment to the live document.
  const handleAcceptSuggestionHunk = async (
    commentId: string,
    hunkId: string,
  ): Promise<"applied" | "unresolvable"> => {
    const comment = comments.find((c) => c.id === commentId);
    const hunks = comment ? parseSuggestions(comment.content) : null;
    const hunk = hunks?.find((h) => h.id === hunkId);
    if (!hunk) return "unresolvable";

    const result = applySuggestionHunks(content, [hunk]);
    const status = result.results[0]?.status ?? "unresolvable";
    if (status === "applied") {
      handleContentChange(result.content);
    }
    return status;
  };

  const handleAcceptAllSuggestions = async (commentId: string) => {
    const comment = comments.find((c) => c.id === commentId);
    const hunks = comment ? parseSuggestions(comment.content) : null;
    if (!hunks || hunks.length === 0) return;

    const result = applySuggestionHunks(content, hunks);
    if (result.results.some((r) => r.status === "applied")) {
      handleContentChange(result.content);
    }
    if (result.results.every((r) => r.status === "applied")) {
      await handleReplyComment(commentId, "Accepted all suggested changes");
      await handleResolveComment(commentId);
    }
  };

  const handleRejectSuggestion = async (commentId: string) => {
    const fileId = fileMetadata?.id || "local_draft";
    try {
      await commentsService.createReply(
        fileId,
        commentId,
        "Rejected suggestion",
        "resolve",
      );
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)),
      );
    } catch (err) {
      console.error("Failed to reject suggestion:", err);
    }
  };

  // Handle document title change
  const handleTitleChange = async (newTitle: string) => {
    const formatted = newTitle.endsWith(".md") ? newTitle : `${newTitle}.md`;
    setDocumentTitle(formatted);
    localStorage.setItem(LOCAL_STORAGE_TITLE_KEY, formatted);

    if (fileMetadata) {
      try {
        const updated = await driveService.renameFile(
          fileMetadata.id,
          formatted,
        );
        // Merge instead of replace: rename responses omit fields like
        // parents, and losing them would misplace later image uploads.
        setFileMetadata((prev) => (prev ? { ...prev, ...updated } : updated));
      } catch (err) {
        console.error("Failed to rename Drive file:", err);
      }
    }
  };

  // Create new document
  const handleNewDocument = async () => {
    if (saveStatus === "unsaved") {
      const confirmNew = window.confirm(
        "You have unsaved changes. Create a new document anyway?",
      );
      if (!confirmNew) return;
    }
    exitSuggestModeSilently();

    try {
      setSaveStatus("saving");
      const newFile = await driveService.createFile(
        "Untitled.md",
        "# Untitled Document\n\n",
      );
      setFileMetadata(newFile);
      setDocumentTitle(newFile.name);
      setContent("# Untitled Document\n\n");
      lastSyncedContentRef.current = "# Untitled Document\n\n";
      setSaveStatus("saved");
      updateUrlFileId(newFile.id);
      await loadComments(newFile.id);
    } catch (err) {
      console.error("Failed to create new file:", err);
      setSaveStatus("error");
    }
  };

  // Create a new document from a template, expanding its variables
  const handleCreateFromTemplate = async (template: DocumentTemplate) => {
    if (saveStatus === "unsaved") {
      const confirmNew = window.confirm(
        "You have unsaved changes. Create a new document anyway?",
      );
      if (!confirmNew) return;
    }
    exitSuggestModeSilently();

    let templateContent = template.content;
    if (template.fileId) {
      // Organization templates fetch their content from Drive on use.
      const result = await driveService.getFile(template.fileId);
      templateContent = result.content;
    }

    const variables = {
      date: new Date().toISOString().slice(0, 10),
      author: user?.displayName || "Unknown author",
      title: documentTitle.replace(/\.md$/i, ""),
    };
    const expanded = expandTemplateVariables(templateContent, variables);

    try {
      setSaveStatus("saving");
      const fileName = `${template.name}.md`.replace(/\s+/g, " ").trim();
      const newFile = await driveService.createFile(fileName, expanded);
      setFileMetadata(newFile);
      setDocumentTitle(newFile.name);
      setContent(expanded);
      lastSyncedContentRef.current = expanded;
      localStorage.setItem(LOCAL_STORAGE_CONTENT_KEY, expanded);
      setSaveStatus("saved");
      updateUrlFileId(newFile.id);
      setSelectedCommentId(null);
      setComments([]);
      await loadComments(newFile.id);
    } catch (err) {
      console.error("Failed to create file from template:", err);
      setSaveStatus("error");
      throw err;
    }
  };

  // Insert a snippet at the cursor with variables expanded
  const handleInsertSnippet = (snippetContent: string) => {
    const expanded = expandTemplateVariables(snippetContent, {
      date: new Date().toISOString().slice(0, 10),
      author: user?.displayName || "Unknown author",
      title: documentTitle.replace(/\.md$/i, ""),
    });
    editorRef.current?.insertBlock(expanded);
  };

  // Comments Handlers
  const handleCreateComment = async (
    commentText: string,
    quotedText?: string,
    line?: number,
  ) => {
    const fileId = fileMetadata?.id || "local_draft";
    const newComment = await commentsService.createComment(
      fileId,
      commentText,
      quotedText,
      line,
    );
    setComments((prev) => [newComment, ...prev]);
    setIsCommentsOpen(true);
    setSelectedCommentId(newComment.id);
  };

  const handleReplyComment = async (commentId: string, replyText: string) => {
    const fileId = fileMetadata?.id || "local_draft";
    const newReply = await commentsService.createReply(
      fileId,
      commentId,
      replyText,
    );
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, replies: [...(c.replies || []), newReply] }
          : c,
      ),
    );
  };

  const handleResolveComment = async (commentId: string) => {
    const fileId = fileMetadata?.id || "local_draft";
    await commentsService.createReply(
      fileId,
      commentId,
      "Resolved discussion",
      "resolve",
    );
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)),
    );
  };

  const handleReopenComment = async (commentId: string) => {
    const fileId = fileMetadata?.id || "local_draft";
    await commentsService.createReply(
      fileId,
      commentId,
      "Reopened discussion",
      "reopen",
    );
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, resolved: false } : c)),
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    const fileId = fileMetadata?.id || "local_draft";
    await commentsService.deleteComment(fileId, commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    if (selectedCommentId === commentId) {
      setSelectedCommentId(null);
    }
  };

  // Interactive task checkbox in the preview writes back to the source
  const handleToggleTask = (lineNumber: number, checked: boolean) => {
    const updated = toggleTaskLine(content, lineNumber, checked);
    if (updated !== content) {
      handleContentChange(updated);
    }
  };

  // Upload pasted or dropped images to Drive and reference them inline
  const handleImagePaste = async (files: File[]) => {
    if (!fileMetadata) {
      window.alert(
        "Image upload needs a Google Drive document. Sign in and open a Drive file first.",
      );
      return;
    }
    try {
      for (const file of files) {
        const uploaded = await driveService.uploadImageFile(
          file,
          fileMetadata.parents?.[0],
        );
        const altText = uploaded.name.replace(/[[\]]/g, "");
        // The thumbnail endpoint renders Drive-hosted images in the browser
        // more reliably than the legacy uc?export=view URLs.
        const imageMarkdown = `![${altText}](https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w2000)`;
        editorRef.current?.insertText(`${imageMarkdown}\n\n`, "", "");
      }
      editorRef.current?.focus();
    } catch (err) {
      console.error("Image upload failed:", err);
      window.alert(err instanceof Error ? err.message : "Image upload failed.");
    }
  };

  // Frontmatter fields shown in the properties panel
  const frontmatterFields = useMemo(
    () => parseFrontmatter(content).fields,
    [content],
  );

  // Review status pill in the header, from the frontmatter field
  const reviewStatus = useMemo(() => {
    const value = frontmatterFields[REVIEW_STATUS_FIELD];
    return typeof value === "string" && value ? value : null;
  }, [frontmatterFields]);

  // Table context toolbar actions rewrite the table block around the cursor
  const handleTableAction = (action: TableAction) => {
    const updated = applyTableAction(content, tableContext?.line ?? 0, action);
    if (updated !== content) {
      handleContentChange(updated);
    }
  };

  const handleUpdateFrontmatterField = (key: string, value: string) => {
    const updated = updateFrontmatterField(content, key, value);
    if (updated !== content) {
      handleContentChange(updated);
    }
  };

  // Synchronized Scrolling Handlers
  const handleEditorScroll = (pct: number) => {
    if (settings.syncScroll && viewMode === "split") {
      previewRef.current?.scrollToPercentage(pct);
    }
  };

  const handlePreviewScroll = (pct: number) => {
    if (settings.syncScroll && viewMode === "split") {
      editorRef.current?.scrollToPercentage(pct);
    }
  };

  // Jump to heading in TOC outline
  const handleSelectHeading = (item: OutlineItem) => {
    editorRef.current?.scrollToLine(item.line);
    previewRef.current?.scrollToHeading(item.id);
  };

  // Keyboard Shortcuts: Ctrl+S for Save, Ctrl+Alt+M for Comment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveDocument();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        (e.key === "m" || e.key === "M")
      ) {
        e.preventDefault();
        setIsNewCommentModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveDocument]);

  const outline = extractOutline(content);
  const openCommentsCount = comments.filter((c) => !c.resolved).length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      {/* App Header */}
      <AppHeader
        documentTitle={documentTitle}
        onChangeTitle={handleTitleChange}
        saveStatus={saveStatus}
        editingMode={editingMode}
        onChangeEditingMode={handleEditingModeChange}
        reviewStatus={reviewStatus}
        onOpenReviewQueue={() => setIsReviewQueueOpen(true)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        user={user}
        fileMetadata={fileMetadata}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onSave={handleSaveDocument}
        onNewDocument={handleNewDocument}
        onOpenFileBrowser={handleOpenFileBrowser}
        onOpenExportModal={() => setIsExportOpen(true)}
        onToggleOutline={() => setIsOutlineOpen(!isOutlineOpen)}
        isOutlineOpen={isOutlineOpen}
        onOpenHistory={handleOpenHistory}
        isHistoryOpen={isHistoryOpen}
        onOpenProperties={() => setIsPropertiesOpen(true)}
        onToggleComments={() => setIsCommentsOpen(!isCommentsOpen)}
        isCommentsOpen={isCommentsOpen}
        openCommentsCount={openCommentsCount}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSignIn={() => authService.signIn()}
        onSignOut={() => authService.signOut()}
      />

      {/* Suggestion mode banner: edits are recorded, not saved */}
      {editingMode === "suggest" && (
        <div className="flex items-center justify-between gap-3 px-4 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-xs no-print">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="font-medium">Suggesting.</span>
            <span className="hidden sm:inline">
              Edits are recorded as suggestions for review, not written to
              Drive.
            </span>
            <span>
              {pendingSuggestionHunks.length} pending change
              {pendingSuggestionHunks.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscardSuggestions}
              className="px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition"
            >
              Discard
            </button>
            <button
              onClick={() => void handleSubmitSuggestions()}
              disabled={pendingSuggestionHunks.length === 0}
              className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50 transition"
            >
              Submit suggestions
            </button>
          </div>
        </div>
      )}

      {editingMode === "suggest" && suggestionError && (
        <div className="px-4 py-1.5 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 no-print">
          {suggestionError}
        </div>
      )}

      {/* Editor Toolbar */}
      <EditorToolbar
        onInsert={(before, after, defaultText) =>
          editorRef.current?.insertText(before, after, defaultText)
        }
        onInsertBlock={(text) => editorRef.current?.insertBlock(text)}
        onOpenTableModal={() => setIsTableModalOpen(true)}
        onOpenComment={() => setIsNewCommentModalOpen(true)}
        onOpenSearch={() => editorRef.current?.openSearch()}
        hasSelection={Boolean(selection?.text)}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
      />

      {/* Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Outline Sidebar */}
        <OutlineSidebar
          isOpen={isOutlineOpen}
          onClose={() => setIsOutlineOpen(false)}
          outline={outline}
          onSelectHeading={handleSelectHeading}
        />

        {/* Code Editor Pane */}
        {(viewMode === "split" || viewMode === "editor") && (
          <div
            className={`editor-pane h-full overflow-hidden relative ${
              viewMode === "split" ? "w-1/2" : "w-full"
            }`}
          >
            <CodeMirrorEditor
              ref={editorRef}
              value={content}
              onChange={handleContentChange}
              isDark={isDark}
              fontSize={settings.fontSize}
              onScroll={handleEditorScroll}
              onSelectionChange={setSelection}
              onImagePaste={handleImagePaste}
              onTableCursorChange={setTableContext}
            />

            {/* Floating Add Comment tooltip */}
            <FloatingCommentButton
              selection={selection}
              onAddComment={() => setIsNewCommentModalOpen(true)}
            />

            {/* Table context toolbar while the cursor is inside a table */}
            {tableContext && (
              <TableToolbar
                columnIndex={tableContext.column}
                onAction={handleTableAction}
              />
            )}
          </div>
        )}

        {/* Markdown Live Preview Pane */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div
            className={`preview-container h-full overflow-hidden ${
              viewMode === "split" ? "w-1/2" : "w-full"
            }`}
          >
            <MarkdownPreview
              ref={previewRef}
              content={content}
              comments={comments}
              isDark={isDark}
              onScroll={handlePreviewScroll}
              onSelectComment={(id) => {
                setIsCommentsOpen(true);
                setSelectedCommentId(id);
              }}
              onToggleTask={handleToggleTask}
              onOpenDocLink={handleOpenDocLink}
            />
          </div>
        )}

        {/* Google Drive Comments Sidebar Drawer */}
        <CommentsSidebar
          isOpen={isCommentsOpen}
          onClose={() => setIsCommentsOpen(false)}
          comments={comments}
          fileId={fileMetadata?.id ?? null}
          selectedCommentId={selectedCommentId}
          onSelectComment={setSelectedCommentId}
          onReplyComment={handleReplyComment}
          onResolveComment={handleResolveComment}
          onReopenComment={handleReopenComment}
          onDeleteComment={handleDeleteComment}
          onOpenNewComment={() => setIsNewCommentModalOpen(true)}
          onAcceptSuggestionHunk={handleAcceptSuggestionHunk}
          onAcceptAllSuggestions={handleAcceptAllSuggestions}
          onRejectSuggestion={handleRejectSuggestion}
        />

        {/* Drive Version History Sidebar Drawer */}
        <HistorySidebar
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          revisions={historyRevisions}
          loading={historyLoading}
          error={historyError}
          selectedId={historySelectedId}
          selectedContent={historySelectedContent}
          currentContent={content}
          comments={comments}
          onSelect={handleSelectRevision}
          onRestore={handleRestoreRevision}
          onRefresh={() => fileMetadata && loadHistory(fileMetadata.id)}
          onSelectComment={(commentId) => {
            setIsCommentsOpen(true);
            setSelectedCommentId(commentId);
          }}
        />
      </div>

      {/* New Comment Modal */}
      <NewCommentModal
        isOpen={isNewCommentModalOpen}
        onClose={() => setIsNewCommentModalOpen(false)}
        selection={selection}
        onSubmit={handleCreateComment}
      />

      {/* Insert Table Modal */}
      <InsertTableModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        onInsertTable={(table) => editorRef.current?.insertBlock(table)}
      />

      {/* Recent Markdown Files Modal */}
      <FileBrowserModal
        isOpen={isFileBrowserOpen}
        onClose={() => setIsFileBrowserOpen(false)}
        files={fileBrowserFiles}
        loading={fileBrowserLoading}
        error={fileBrowserError}
        onSelect={handleOpenFile}
        onRefresh={loadFileList}
      />

      {/* Frontmatter Properties Panel */}
      <PropertiesPanel
        isOpen={isPropertiesOpen}
        onClose={() => setIsPropertiesOpen(false)}
        fields={frontmatterFields}
        onUpdateField={handleUpdateFrontmatterField}
      />

      {/* Review queue of documents marked in review */}
      <ReviewQueueModal
        isOpen={isReviewQueueOpen}
        onClose={() => setIsReviewQueueOpen(false)}
        onOpenFile={handleOpenFile}
      />

      {/* Templates and snippets */}
      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        templatesFolderId={settings.templatesFolderId}
        onCreateFromTemplate={handleCreateFromTemplate}
        onInsertSnippet={handleInsertSnippet}
      />

      {/* Save Conflict Resolution Modal */}
      {conflict !== null && (
        <ConflictModal
          isOpen
          onClose={handleDismissConflict}
          localContent={content}
          remoteContent={conflict.remoteContent}
          baseContent={conflict.baseContent}
          onResolve={handleResolveConflict}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          authService.setClientId(newSettings.googleClientId);
          localStorage.setItem(
            LOCAL_STORAGE_SETTINGS_KEY,
            JSON.stringify(newSettings),
          );
        }}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        documentTitle={documentTitle}
        markdownContent={content}
      />
    </div>
  );
};
export default App;
