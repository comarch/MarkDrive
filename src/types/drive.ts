export interface DriveUser {
  displayName: string;
  emailAddress: string;
  photoLink?: string;
  me?: boolean;
}

export interface DriveStateParam {
  action: "open" | "create";
  ids?: string[];
  folderId?: string;
  folderResourceKey?: string;
  resourceKeys?: Record<string, string>;
  userId?: string;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
  capabilities?: {
    canEdit?: boolean;
    canComment?: boolean;
  };
}

export interface DriveReply {
  id: string;
  kind: string;
  createdTime: string;
  modifiedTime: string;
  author: DriveUser;
  htmlContent: string;
  content: string;
  deleted?: boolean;
  action?: "resolve" | "reopen";
}

export interface DriveCommentAnchorRegion {
  kind?: string;
  line?: number;
  from?: number;
  to?: number;
  rev?: string;
}

export interface DriveCommentAnchor {
  region?: DriveCommentAnchorRegion;
  [key: string]: unknown;
}

export interface DriveComment {
  id: string;
  kind: string;
  createdTime: string;
  modifiedTime: string;
  author: DriveUser;
  htmlContent: string;
  content: string;
  deleted?: boolean;
  resolved?: boolean;
  anchor?: string; // JSON string in Drive API
  quotedFileContent?: {
    mimeType?: string;
    value?: string;
  };
  replies?: DriveReply[];
}

export type SaveStatus = "saved" | "saving" | "unsaved" | "error" | "offline";
