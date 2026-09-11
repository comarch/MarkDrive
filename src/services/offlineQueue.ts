// Offline queue for Drive saves. When the network drops, pending saves
// land in IndexedDB (one entry per file, newest wins) and replay against
// Drive on reconnect with the same revision conflict check as live
// saves. A queue that replays blindly would lose concurrent edits, so
// every entry keeps the head revision it was based on.

export interface OfflineSaveEntry {
  fileId: string;
  name: string;
  content: string;
  /** Drive headRevisionId the queued content was based on. */
  baseRevisionId: string | null;
  /** Content the session last synced, for three-way conflict merges. */
  baseContent: string;
  savedAt: string;
}

export interface ReplayConflict {
  entry: OfflineSaveEntry;
  remoteContent: string;
}

export interface ReplayCallbacks {
  fetchHeadRevisionId(fileId: string): Promise<string | null>;
  getFile(fileId: string): Promise<{ content: string }>;
  updateFile(fileId: string, content: string, name?: string): Promise<unknown>;
}

export interface ReplayResult {
  replayed: OfflineSaveEntry[];
  conflicts: ReplayConflict[];
  failures: OfflineSaveEntry[];
}

/** Decides one queued save against the current Drive head. */
export const decideReplay = (
  entry: OfflineSaveEntry,
  remoteHead: string | null,
): "save" | "conflict" => {
  if (remoteHead === null) return "save";
  if (entry.baseRevisionId === null) return "save";
  return remoteHead === entry.baseRevisionId ? "save" : "conflict";
};

/** Keeps one entry per file, the newest by savedAt. */
export const mergeQueuedSaves = (
  entries: OfflineSaveEntry[],
): OfflineSaveEntry[] => {
  const byFile = new Map<string, OfflineSaveEntry>();
  for (const entry of entries) {
    const existing = byFile.get(entry.fileId);
    if (!existing || existing.savedAt <= entry.savedAt) {
      byFile.set(entry.fileId, entry);
    }
  }
  return [...byFile.values()];
};

/**
 * Replays queued saves in order. Conflicts stop that file's replay and
 * surface the remote content for the merge dialog; other files continue.
 * Failures (network still down, permission lost) keep their entries.
 */
export const replayQueue = async (
  entries: OfflineSaveEntry[],
  callbacks: ReplayCallbacks,
  onSaved?: (entry: OfflineSaveEntry) => void,
): Promise<ReplayResult> => {
  const result: ReplayResult = { replayed: [], conflicts: [], failures: [] };
  const ordered = mergeQueuedSaves(entries);
  for (const entry of ordered) {
    const decision = await (async () => {
      try {
        const remoteHead = await callbacks.fetchHeadRevisionId(entry.fileId);
        return decideReplay(entry, remoteHead);
      } catch {
        return "fail" as const;
      }
    })();
    if (decision === "fail") {
      result.failures.push(entry);
      continue;
    }
    if (decision === "conflict") {
      try {
        const remote = await callbacks.getFile(entry.fileId);
        result.conflicts.push({ entry, remoteContent: remote.content });
      } catch {
        result.failures.push(entry);
      }
      continue;
    }
    try {
      await callbacks.updateFile(entry.fileId, entry.content, entry.name);
      result.replayed.push(entry);
      onSaved?.(entry);
    } catch {
      result.failures.push(entry);
    }
  }
  return result;
};

/** True when an error looks like the network being unreachable. */
export const isNetworkError = (error: unknown): boolean => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  return error instanceof TypeError;
};

// ---- IndexedDB storage (browser only, kept thin) ----

const DB_NAME = "markquire-offline";
const STORE = "queue";
const DB_VERSION = 1;

const openQueueDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "fileId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openQueueDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    };
  });
};

/** Adds or replaces the queued save for one file. */
export const enqueueSave = async (entry: OfflineSaveEntry): Promise<void> => {
  await withStore(
    "readwrite",
    (store) => store.put(entry) as IDBRequest<IDBValidKey>,
  );
};

/** Lists every queued save. */
export const listQueuedSaves = async (): Promise<OfflineSaveEntry[]> => {
  const entries = await withStore<OfflineSaveEntry[]>(
    "readonly",
    (store) => store.getAll() as IDBRequest<OfflineSaveEntry[]>,
  );
  return mergeQueuedSaves(entries);
};

/** Drops a queued save after it reached Drive. */
export const removeQueuedSave = async (fileId: string): Promise<void> => {
  await withStore(
    "readwrite",
    (store) => store.delete(fileId) as unknown as IDBRequest<undefined>,
  );
};

/** Number of files with pending saves, for status surfaces. */
export const queuedSaveCount = async (): Promise<number> => {
  const entries = await listQueuedSaves();
  return entries.length;
};
