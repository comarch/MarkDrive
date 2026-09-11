// Client for the optional companion service. Every call is best effort:
// without a configured companion the app keeps all core behavior, and a
// failing companion never blocks editing, saving, or review.

export interface CompanionSearchHit {
  fileId: string;
  name: string;
  score: number;
  snippet: string;
}

/**
 * Validates the configured companion URL before any request: only
 * well-formed http(s) URLs pass, so a mangled setting can never turn
 * into a request to an unexpected scheme or host.
 */
const safeBaseUrl = (companionUrl: string): string | null => {
  try {
    const url = new URL(companionUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

const jsonFetch = async <T>(
  url: string,
  init: RequestInit,
): Promise<T | null> => {
  try {
    const response = await fetch(url, init);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

/** Registers a Drive changes.watch channel through the companion. */
export const registerDriveWatch = (
  companionUrl: string,
  fileId: string,
  accessToken: string,
): Promise<{ channelId: string; expiresAt: string } | null> => {
  const base = safeBaseUrl(companionUrl);
  if (base === null) return Promise.resolve(null);
  return jsonFetch(`${base}/v1/drive/watch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, accessToken }),
  });
};

/** Pushes one document into the organization search index. */
export const indexForSearch = (
  companionUrl: string,
  entry: { fileId: string; name: string; content: string },
): Promise<{ ok: boolean } | null> => {
  const base = safeBaseUrl(companionUrl);
  if (base === null) return Promise.resolve(null);
  return jsonFetch(`${base}/v1/search/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
};

/** Queries the organization index; null means no companion or failure. */
export const searchCompanion = (
  companionUrl: string,
  query: string,
): Promise<{ results: CompanionSearchHit[] } | null> => {
  const base = safeBaseUrl(companionUrl);
  if (base === null) return Promise.resolve(null);
  return jsonFetch(`${base}/v1/search?q=${encodeURIComponent(query)}`, {});
};

/** Fans a review event out to the configured integrations. */
export const notifyIntegration = (
  companionUrl: string,
  event: {
    event: string;
    fileId?: string;
    text: string;
  },
): Promise<{ ok: boolean } | null> => {
  const base = safeBaseUrl(companionUrl);
  if (base === null) return Promise.resolve(null);
  return jsonFetch(`${base}/v1/integrations/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
};

export interface CompanionEventStream {
  close: () => void;
}

/**
 * Subscribes to JSON events (drive-change) for one file. Returns null
 * when WebSockets are unavailable; callbacks fire only for valid frames.
 */
export const openEventStream = (
  companionUrl: string,
  fileId: string,
  onDriveChange: () => void,
): CompanionEventStream | null => {
  if (typeof WebSocket === "undefined") return null;
  const base = safeBaseUrl(companionUrl);
  if (base === null) return null;
  const wsUrl = base.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  let socket: WebSocket;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const connect = () => {
    if (closed) return;
    socket = new WebSocket(
      `${wsUrl}/events?room=${encodeURIComponent(fileId)}`,
    );
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as { type?: string };
        if (message.type === "drive-change") onDriveChange();
      } catch {
        // Ignore malformed frames.
      }
    };
    socket.onopen = () => {
      heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 25_000);
    };
    socket.onclose = () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      // Reconnect with a delay; the companion may just be restarting.
      if (!closed) setTimeout(connect, 3_000);
    };
  };
  connect();
  return {
    close: () => {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      socket?.close();
    },
  };
};
