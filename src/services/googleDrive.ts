import { DriveFileMetadata } from "../types/drive";
import { authService } from "./googleAuth";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_API_BASE = "https://www.googleapis.com/upload/drive/v3";

// Local mock storage for offline / testing without Google credentials
const MOCK_FILES_KEY = "gdrive_mock_files";

interface MockFileEntry {
  metadata: DriveFileMetadata;
  content: string;
}

function getMockStorage(): Record<string, MockFileEntry> {
  try {
    const raw = localStorage.getItem(MOCK_FILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMockStorage(store: Record<string, MockFileEntry>): void {
  localStorage.setItem(MOCK_FILES_KEY, JSON.stringify(store));
}

export class GoogleDriveService {
  /**
   * Fetches file content and metadata from Google Drive
   */
  public async getFile(
    fileId: string,
  ): Promise<{ content: string; metadata: DriveFileMetadata }> {
    const token = authService.getAccessToken();

    // Check mock storage if token is mock or no real token
    if (!token || token.startsWith("mock_google_token_")) {
      const store = getMockStorage();
      if (store[fileId]) {
        return store[fileId];
      }
      // Return a default entry
      return {
        metadata: {
          id: fileId,
          name: "Untitled.md",
          mimeType: "text/markdown",
          modifiedTime: new Date().toISOString(),
          capabilities: { canEdit: true, canComment: true },
        },
        content: "# Untitled Document\n\nStart writing markdown here...\n",
      };
    }

    // 1. Fetch metadata
    const metaRes = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,modifiedTime,webViewLink,parents,capabilities,headRevisionId`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!metaRes.ok) {
      throw new Error(`Failed to load file metadata: ${metaRes.statusText}`);
    }

    const metadata: DriveFileMetadata = await metaRes.json();

    // 2. Fetch file content
    const contentRes = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!contentRes.ok) {
      throw new Error(
        `Failed to download file content: ${contentRes.statusText}`,
      );
    }

    const content = await contentRes.text();
    return { metadata, content };
  }

  /**
   * Updates file content and/or name in Google Drive
   */
  public async updateFile(
    fileId: string,
    content: string,
    name?: string,
  ): Promise<DriveFileMetadata> {
    const token = authService.getAccessToken();

    if (!token || token.startsWith("mock_google_token_")) {
      const store = getMockStorage();
      const existing = store[fileId] || {
        metadata: {
          id: fileId,
          name: name || "Untitled.md",
          mimeType: "text/markdown",
          capabilities: { canEdit: true, canComment: true },
        },
        content: "",
      };

      existing.content = content;
      if (name) existing.metadata.name = name;
      existing.metadata.modifiedTime = new Date().toISOString();
      store[fileId] = existing;
      saveMockStorage(store);
      return existing.metadata;
    }

    // Multipart upload to update both content and metadata (if name changed)
    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = JSON.stringify({
      name: name,
      mimeType: "text/markdown",
      modifiedTime: new Date().toISOString(),
    });

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      metadataPart +
      delimiter +
      "Content-Type: text/markdown; charset=UTF-8\r\n\r\n" +
      content +
      closeDelimiter;

    const res = await fetch(
      `${UPLOAD_API_BASE}/files/${fileId}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,parents,capabilities,headRevisionId`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      },
    );

    if (!res.ok) {
      throw new Error(
        `Failed to update file on Google Drive: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  /**
   * Creates a new Markdown file on Google Drive
   */
  public async createFile(
    name: string,
    content: string,
    folderId?: string,
  ): Promise<DriveFileMetadata> {
    const token = authService.getAccessToken();

    if (!token || token.startsWith("mock_google_token_")) {
      const id = "mock_file_" + Math.random().toString(36).substring(2, 10);
      const metadata: DriveFileMetadata = {
        id,
        name: name.endsWith(".md") ? name : `${name}.md`,
        mimeType: "text/markdown",
        modifiedTime: new Date().toISOString(),
        parents: folderId ? [folderId] : undefined,
        capabilities: { canEdit: true, canComment: true },
      };
      const store = getMockStorage();
      store[id] = { metadata, content };
      saveMockStorage(store);
      return metadata;
    }

    const metadata: Record<string, unknown> = {
      name: name.endsWith(".md") ? name : `${name}.md`,
      mimeType: "text/markdown",
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: text/markdown; charset=UTF-8\r\n\r\n" +
      content +
      closeDelimiter;

    const res = await fetch(
      `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink,capabilities,parents,headRevisionId`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      },
    );

    if (!res.ok) {
      throw new Error(
        `Failed to create file on Google Drive: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  /**
   * Fetches the current head revision ID for a file.
   */
  public async fetchHeadRevisionId(fileId: string): Promise<string | null> {
    const token = authService.getAccessToken();

    if (!token || token.startsWith("mock_google_token_")) {
      return getMockStorage()[fileId]?.metadata.headRevisionId ?? null;
    }

    const res = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?fields=headRevisionId`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      throw new Error(
        `Failed to load file revision metadata: ${res.statusText}`,
      );
    }

    const data = (await res.json()) as { headRevisionId?: string };
    return data.headRevisionId ?? null;
  }

  /**
   * Uploads an image file to Google Drive.
   */
  public async uploadImageFile(
    file: File,
    folderId?: string,
  ): Promise<DriveFileMetadata> {
    const token = authService.getAccessToken();

    if (!token || token.startsWith("mock_google_token_")) {
      throw new Error("Image upload requires signing in to Google Drive.");
    }

    const metadata: Record<string, unknown> = {
      name: file.name,
      mimeType: file.type,
    };
    if (folderId) {
      metadata.parents = [folderId];
    }

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    const fileContent = await file.arrayBuffer();
    const multipartRequestBody = new Blob(
      [
        delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${file.type}\r\n\r\n`,
        fileContent,
        closeDelimiter,
      ],
      { type: `multipart/related; boundary=${boundary}` },
    );

    const res = await fetch(
      `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      },
    );

    if (!res.ok) {
      throw new Error(
        `Failed to upload image to Google Drive: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  /**
   * Renames a file on Google Drive
   */
  public async renameFile(
    fileId: string,
    newName: string,
  ): Promise<DriveFileMetadata> {
    const token = authService.getAccessToken();

    if (!token || token.startsWith("mock_google_token_")) {
      const store = getMockStorage();
      if (store[fileId]) {
        store[fileId].metadata.name = newName;
        saveMockStorage(store);
        return store[fileId].metadata;
      }
      return { id: fileId, name: newName, mimeType: "text/markdown" };
    }

    const res = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,modifiedTime,headRevisionId`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName }),
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to rename file: ${res.statusText}`);
    }

    return await res.json();
  }
}

export const driveService = new GoogleDriveService();
