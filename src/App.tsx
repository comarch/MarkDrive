import React, { useState, useEffect, useRef, useCallback } from "react";
import { AppHeader } from "./components/Header/AppHeader";
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

import { authService } from "./services/googleAuth";
import { driveService } from "./services/googleDrive";
import { commentsService } from "./services/googleComments";
import { parseDriveStateFromUrl, updateUrlFileId } from "./services/driveState";
import { SAMPLE_MARKDOWN } from "./utils/sampleDocument";
import { toggleTaskLine } from "./utils/tasks";

import {
  DriveUser,
  DriveFileMetadata,
  SaveStatus,
  DriveComment,
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

  // Editor Selection & View Mode
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  // Component Refs
  const editorRef = useRef<CodeMirrorEditorHandle>(null);
  const previewRef = useRef<MarkdownPreviewHandle>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setSaveStatus("saving");
    try {
      if (fileMetadata) {
        // Save to Google Drive
        const updated = await driveService.updateFile(
          fileMetadata.id,
          content,
          documentTitle,
        );
        setFileMetadata(updated);
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

  // Handle document content change & auto-save
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setSaveStatus("unsaved");
    localStorage.setItem(LOCAL_STORAGE_CONTENT_KEY, newContent);

    if (settings.autoSaveIntervalMs > 0) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        handleSaveDocument();
      }, settings.autoSaveIntervalMs);
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
        setFileMetadata(updated);
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

    try {
      setSaveStatus("saving");
      const newFile = await driveService.createFile(
        "Untitled.md",
        "# Untitled Document\n\n",
      );
      setFileMetadata(newFile);
      setDocumentTitle(newFile.name);
      setContent("# Untitled Document\n\n");
      setSaveStatus("saved");
      updateUrlFileId(newFile.id);
      await loadComments(newFile.id);
    } catch (err) {
      console.error("Failed to create new file:", err);
      setSaveStatus("error");
    }
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
        user={user}
        fileMetadata={fileMetadata}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onSave={handleSaveDocument}
        onNewDocument={handleNewDocument}
        onOpenExportModal={() => setIsExportOpen(true)}
        onToggleOutline={() => setIsOutlineOpen(!isOutlineOpen)}
        isOutlineOpen={isOutlineOpen}
        onToggleComments={() => setIsCommentsOpen(!isCommentsOpen)}
        isCommentsOpen={isCommentsOpen}
        openCommentsCount={openCommentsCount}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSignIn={() => authService.signIn()}
        onSignOut={() => authService.signOut()}
      />

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
            />

            {/* Floating Add Comment tooltip */}
            <FloatingCommentButton
              selection={selection}
              onAddComment={() => setIsNewCommentModalOpen(true)}
            />
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
            />
          </div>
        )}

        {/* Google Drive Comments Sidebar Drawer */}
        <CommentsSidebar
          isOpen={isCommentsOpen}
          onClose={() => setIsCommentsOpen(false)}
          comments={comments}
          selectedCommentId={selectedCommentId}
          onSelectComment={setSelectedCommentId}
          onReplyComment={handleReplyComment}
          onResolveComment={handleResolveComment}
          onReopenComment={handleReopenComment}
          onDeleteComment={handleDeleteComment}
          onOpenNewComment={() => setIsNewCommentModalOpen(true)}
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
