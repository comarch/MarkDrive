// Audit log for compliance review: who changed what and when, as far as
// this service can see (relay joins, webhook receipts, watch
// registrations, integration deliveries). Entries are JSONL, pruned by
// the retention window, exportable with an optional since filter.

import { readFileSync, appendFileSync, existsSync } from "node:fs";

export const createAuditLog = (logPath = "", retentionDays = 365) => {
  const entries = [];
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

  // Load persisted history once; a missing or unreadable file starts
  // fresh rather than failing the service.
  if (logPath && existsSync(logPath)) {
    try {
      for (const line of readFileSync(logPath, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        try {
          entries.push(JSON.parse(trimmed));
        } catch {
          // Skip malformed lines; the log must stay readable.
        }
      }
    } catch {
      // Start fresh on unreadable logs.
    }
  }

  const prune = () => {
    // A zero-day retention keeps nothing; only negative windows are
    // invalid and skipped.
    if (!Number.isFinite(retentionMs) || retentionMs < 0) return;
    const cutoff = Date.now() - retentionMs;
    while (
      entries.length > 0 &&
      Date.parse(entries[0]?.timestamp ?? "") < cutoff
    ) {
      entries.shift();
    }
  };

  return {
    record(event, details = {}) {
      prune();
      const entry = {
        timestamp: new Date().toISOString(),
        // Details spread first so a caller's "event" field cannot
        // override the audit event name.
        ...details,
        event,
      };
      entries.push(entry);
      if (logPath) {
        try {
          appendFileSync(logPath, JSON.stringify(entry) + "\n");
        } catch {
          // Persistence failures never break the request path.
        }
      }
      return entry;
    },

    export(since) {
      prune();
      const cutoff = since ? Date.parse(since) : NaN;
      const rows = Number.isNaN(cutoff)
        ? entries
        : entries.filter((entry) => Date.parse(entry.timestamp) >= cutoff);
      return rows.map((entry) => JSON.stringify(entry)).join("\n") + (rows.length ? "\n" : "");
    },

    stats() {
      prune();
      const byEvent = {};
      for (const entry of entries) {
        byEvent[entry.event] = (byEvent[entry.event] ?? 0) + 1;
      }
      return {
        count: entries.length,
        retentionDays,
        byEvent,
        first: entries[0]?.timestamp ?? null,
        last: entries[entries.length - 1]?.timestamp ?? null,
      };
    },

    pendingCount() {
      return entries.length;
    },
  };
};
