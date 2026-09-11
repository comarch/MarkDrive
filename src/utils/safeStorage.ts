// Document drafts, titles, and settings may originate from Google Drive
// responses, which are external input. Every browser-storage write passes
// through this module so the stored payload stays inert: control characters
// are stripped, the size stays inside the storage quota, and the text is
// percent-encoded under a v2 marker (legacy raw entries still read back).
// Readers keep treating stored values as untrusted content.

const MAX_STORED_LENGTH = 2_000_000;

// C0 controls except tab/newline/carriage return, DEL, and C1 controls.
/* eslint-disable no-control-regex -- stripping these characters is the purpose of the sanitizer */
const CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F]/g;
/* eslint-enable no-control-regex */

export function sanitizeStoredText(value: string): string {
  return value.replace(CONTROL_CHARACTERS, "").slice(0, MAX_STORED_LENGTH);
}

export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(
      key,
      `v2:${encodeURIComponent(sanitizeStoredText(value))}`,
    );
  } catch {
    // Quota exceeded or storage unavailable; in-memory state stays
    // authoritative and the next successful write retries.
  }
}

export function safeGetItem(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    if (raw.startsWith("v2:")) return decodeURIComponent(raw.slice(3));
    return raw;
  } catch {
    return null;
  }
}
