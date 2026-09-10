import { DriveComment, DriveReply } from "../types/drive";
import { authService } from "./googleAuth";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const MOCK_COMMENTS_KEY = "gdrive_mock_comments";

function getMockCommentsStorage(): Record<string, DriveComment[]> {
  try {
    const raw = localStorage.getItem(MOCK_COMMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMockCommentsStorage(store: Record<string, DriveComment[]>): void {
  localStorage.setItem(MOCK_COMMENTS_KEY, JSON.stringify(store));
}

export class GoogleCommentsService {
  /**
   * Lists all comments for a specific Google Drive file
   */
  public async listComments(fileId: string): Promise<DriveComment[]> {
    const token = authService.getAccessToken();

    if (!token || token.startsWith("mock_google_token_")) {
      const store = getMockCommentsStorage();
      if (!store[fileId]) {
        // Seed default sample comments for demonstration
        store[fileId] = [
          {
            id: "sample_comment_1",
            kind: "drive#comment",
            createdTime: new Date(Date.now() - 3600000).toISOString(),
            modifiedTime: new Date(Date.now() - 3600000).toISOString(),
            author: {
              displayName: "Anna Reviewer",
              emailAddress: "anna@example.invalid",
            },
            content:
              "Could we add the approval step to this flow before rollout?",
            htmlContent:
              "Could we add the approval step to this flow before rollout?",
            resolved: false,
            quotedFileContent: {
              mimeType: "text/markdown",
              value: "Diagrams & Flowcharts",
            },
            replies: [
              {
                id: "reply_1",
                kind: "drive#reply",
                createdTime: new Date(Date.now() - 1800000).toISOString(),
                modifiedTime: new Date(Date.now() - 1800000).toISOString(),
                author: {
                  displayName: "Tomasz Author",
                  emailAddress: "tomasz@example.invalid",
                },
                content:
                  "Good point. I will update the diagram and resolve this thread.",
                htmlContent:
                  "Good point. I will update the diagram and resolve this thread.",
              },
            ],
          },
        ];
        saveMockCommentsStorage(store);
      }
      return store[fileId].filter((c) => !c.deleted);
    }

    // Google Drive Comments API requires the `fields` parameter
    const fields =
      "comments(id,kind,createdTime,modifiedTime,resolved,deleted,htmlContent,content,author,anchor,quotedFileContent,replies(id,kind,createdTime,modifiedTime,action,content,htmlContent,author,deleted))";

    const res = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}/comments?fields=${encodeURIComponent(fields)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to list comments: ${res.statusText}`);
    }

    const data = await res.json();
    return (data.comments || []).filter((c: DriveComment) => !c.deleted);
  }

  /**
   * Creates a new comment (optionally anchored to text and line number)
   */
  public async createComment(
    fileId: string,
    content: string,
    quotedText?: string,
    line?: number,
  ): Promise<DriveComment> {
    const token = authService.getAccessToken();
    const currentUser = authService.getCurrentUser() || {
      displayName: "Anonymous User",
      emailAddress: "user@example.invalid",
    };

    if (!token || token.startsWith("mock_google_token_")) {
      const store = getMockCommentsStorage();
      const comments = store[fileId] || [];

      const newComment: DriveComment = {
        id: "comment_" + Date.now(),
        kind: "drive#comment",
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
        author: currentUser,
        content,
        htmlContent: content,
        resolved: false,
        quotedFileContent: quotedText
          ? {
              mimeType: "text/markdown",
              value: quotedText,
            }
          : undefined,
        anchor: line
          ? JSON.stringify({
              region: {
                kind: "drive#commentRegion",
                line,
                rev: "head",
              },
            })
          : undefined,
        replies: [],
      };

      comments.unshift(newComment);
      store[fileId] = comments;
      saveMockCommentsStorage(store);
      return newComment;
    }

    const body: Record<string, unknown> = {
      content,
    };

    if (quotedText) {
      body.quotedFileContent = {
        mimeType: "text/markdown",
        value: quotedText,
      };
    }

    if (line) {
      body.anchor = JSON.stringify({
        region: {
          kind: "drive#commentRegion",
          line,
          rev: "head",
        },
      });
    }

    const res = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}/comments?fields=*`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      throw new Error(
        `Failed to post comment to Google Drive: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  /**
   * Adds a reply to an existing comment thread (or resolves it)
   */
  public async createReply(
    fileId: string,
    commentId: string,
    content: string,
    action?: "resolve" | "reopen",
  ): Promise<DriveReply> {
    const token = authService.getAccessToken();
    const currentUser = authService.getCurrentUser() || {
      displayName: "Anonymous User",
      emailAddress: "user@example.invalid",
    };

    if (!token || token.startsWith("mock_google_token_")) {
      const store = getMockCommentsStorage();
      const comments = store[fileId] || [];
      const comment = comments.find((c) => c.id === commentId);

      if (!comment) throw new Error("Comment not found");

      const reply: DriveReply = {
        id: "reply_" + Date.now(),
        kind: "drive#reply",
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
        author: currentUser,
        content,
        htmlContent: content,
        action,
      };

      if (!comment.replies) comment.replies = [];
      comment.replies.push(reply);

      if (action === "resolve") {
        comment.resolved = true;
      } else if (action === "reopen") {
        comment.resolved = false;
      }

      store[fileId] = comments;
      saveMockCommentsStorage(store);
      return reply;
    }

    const body: Record<string, unknown> = {
      content,
    };

    if (action) {
      body.action = action;
    }

    const res = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}/comments/${commentId}/replies?fields=*`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to post reply: ${res.statusText}`);
    }

    return await res.json();
  }

  /**
   * Deletes a comment
   */
  public async deleteComment(fileId: string, commentId: string): Promise<void> {
    const token = authService.getAccessToken();

    if (!token || token.startsWith("mock_google_token_")) {
      const store = getMockCommentsStorage();
      const comments = store[fileId] || [];
      store[fileId] = comments.filter((c) => c.id !== commentId);
      saveMockCommentsStorage(store);
      return;
    }

    const res = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}/comments/${commentId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to delete comment: ${res.statusText}`);
    }
  }
}

export const commentsService = new GoogleCommentsService();
