// Drive change notifications. The client registers a changes.watch
// channel through this service using its own short-lived access token
// (never stored); Drive then calls back into /v1/drive/notify with the
// shared webhook token. Channels expire, so a timer re-registers them
// before they do.

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
// Drive caps watch channels well below seven days; renew sooner.
const CHANNEL_TTL_MS = 6 * 60 * 60 * 1000;

export const createDriveWatch = (
  webhookSecret = "",
  publicUrl = "",
  renewalIntervalMs = 60 * 60 * 1000,
  audit = null,
) => {
  // channelId -> { fileId, expiresAt }
  const channels = new Map();
  // fileId -> channelId (latest wins; one watch per file).
  const channelByFile = new Map();
  const fetchImpl = globalThis.fetch;
  let renewalTimer = null;

  const isEnabled = () => webhookSecret.length > 0 && publicUrl.length > 0;

  const register = async (fileId, accessToken) => {
    if (!isEnabled()) {
      return {
        ok: false,
        status: 503,
        error: "Drive webhooks are not configured.",
      };
    }
    const channelId = `mq-${fileId}-${Date.now().toString(36)}`;
    try {
      const response = await fetchImpl(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/watch`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: channelId,
            type: "web_hook",
            address: `${publicUrl.replace(/\/$/, "")}/v1/drive/notify`,
            token: webhookSecret,
          }),
        },
      );
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: `Drive rejected the watch: ${response.status}`,
        };
      }
      const payload = await response.json().catch(() => ({}));
      const expiresAt = payload.expiration
        ? new Date(payload.expiration).toISOString()
        : new Date(Date.now() + CHANNEL_TTL_MS).toISOString();
      // A new channel replaces the old one for this file.
      const previous = channelByFile.get(fileId);
      if (previous) channels.delete(previous);
      channels.set(channelId, { fileId, expiresAt });
      channelByFile.set(fileId, channelId);
      return { ok: true, channelId, expiresAt };
    } catch (error) {
      return {
        ok: false,
        error: `Drive watch request failed: ${String(error)}`,
      };
    }
  };

  const verifyNotification = (token) =>
    token === webhookSecret && webhookSecret.length > 0;

  const fileIdForChannel = (channelId) =>
    channels.get(channelId)?.fileId ?? null;

  // Renewal: re-register watches with the tokens kept for them. Tokens
  // expire too, so a failed renewal drops the watch instead of looping.
  const tokens = new Map(); // fileId -> accessToken (session lifetime)
  const rememberToken = (fileId, accessToken) => {
    tokens.set(fileId, accessToken);
  };

  const startRenewal = () => {
    if (renewalTimer || renewalIntervalMs <= 0) return;
    renewalTimer = setInterval(async () => {
      for (const [channelId, entry] of channels) {
        const expiresIn = new Date(entry.expiresAt).getTime() - Date.now();
        if (expiresIn > renewalIntervalMs) continue;
        const token = tokens.get(entry.fileId);
        if (!token) {
          channels.delete(channelId);
          channelByFile.delete(entry.fileId);
          continue;
        }
        const result = await register(entry.fileId, token);
        if (result.ok) {
          channels.delete(channelId);
          audit?.record("drive.watch.renewed", { fileId: entry.fileId });
        } else {
          channels.delete(channelId);
          channelByFile.delete(entry.fileId);
          audit?.record("drive.watch.renewalFailed", {
            fileId: entry.fileId,
            error: result.error,
          });
        }
      }
    }, renewalIntervalMs);
    renewalTimer.unref?.();
  };

  const stop = () => {
    if (renewalTimer) {
      clearInterval(renewalTimer);
      renewalTimer = null;
    }
  };

  return {
    isEnabled,
    register: async (fileId, accessToken) => {
      rememberToken(fileId, accessToken);
      const result = await register(fileId, accessToken);
      if (result.ok) startRenewal();
      return result;
    },
    verifyNotification,
    fileIdForChannel,
    channels: () =>
      [...channels.entries()].map(([id, entry]) => ({ id, ...entry })),
    stop,
  };
};
