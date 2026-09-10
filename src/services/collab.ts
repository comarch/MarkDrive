// Collaborative editing session over the optional companion relay.
//
// The Yjs document is the live editing truth while the session is open;
// Drive remains the durability layer through the normal autosave. The
// awareness protocol carries presence (name and color per author).

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export interface CollabPeer {
  clientId: number;
  name: string;
  color: string;
}

export interface CollabSession {
  doc: Y.Doc;
  provider: WebsocketProvider;
  /** Live text; bind the editor to this. */
  text: Y.Text;
  peers: () => CollabPeer[];
  destroy: () => void;
}

const PEER_COLORS = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
];

const colorFor = (clientId: number) =>
  PEER_COLORS[Math.abs(clientId) % PEER_COLORS.length] ?? "#2563eb";

/**
 * Pushes a whole-document content string into the shared text with a
 * middle-diff, so cursors and undo history outside the change survive
 * and the CRDT only records what actually changed.
 */
export const applyContentToText = (text: Y.Text, content: string): void => {
  const current = text.toString();
  if (current === content) return;
  let start = 0;
  const oldEnd = current.length;
  const newEnd = content.length;
  while (
    start < oldEnd &&
    start < newEnd &&
    current[start] === content[start]
  ) {
    start += 1;
  }
  let tailOld = oldEnd;
  let tailNew = newEnd;
  while (
    tailOld > start &&
    tailNew > start &&
    current[tailOld - 1] === content[tailNew - 1]
  ) {
    tailOld -= 1;
    tailNew -= 1;
  }
  text.doc?.transact(() => {
    if (tailOld > start) {
      text.delete(start, tailOld - start);
    }
    if (tailNew > start) {
      text.insert(start, content.slice(start, tailNew));
    }
  });
};

interface AwarenessState {
  user?: { name?: string; color?: string };
}

/**
 * Opens a relay session for one file. `initialContent` seeds the room
 * when nobody has initialized it yet; an existing room state wins, so
 * late joiners converge on the live document.
 */
export const openCollabSession = (
  companionUrl: string,
  fileId: string,
  author: { name: string },
  initialContent: string,
  onPeersChange?: (peers: CollabPeer[]) => void,
): CollabSession => {
  const doc = new Y.Doc();
  const text = doc.getText("content");
  const wsUrl = companionUrl
    .replace(/\/$/, "")
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:");
  const provider = new WebsocketProvider(wsUrl, `file-${fileId}`, doc, {
    connect: true,
  });
  const awareness = provider.awareness;

  const clientId = awareness.clientID;
  awareness.setLocalState({
    user: { name: author.name, color: colorFor(clientId) },
  });

  const peers = (): CollabPeer[] => {
    const list: CollabPeer[] = [];
    for (const [id, state] of awareness.getStates()) {
      const user = (state as AwarenessState)?.user;
      if (!user?.name) continue;
      list.push({
        clientId: id,
        name: user.name,
        color: user.color ?? colorFor(id),
      });
    }
    return list.sort((a, b) => a.clientId - b.clientId);
  };

  const notify = () => onPeersChange?.(peers());
  awareness.on("update", notify);

  // Wait for the sync handshake before touching the shared text, so a
  // joiner never overwrites the room with stale local content. The
  // "sync" event fires on every completed handshake.
  const initializeFromContent = () => {
    // First author into an empty room seeds it from the Drive content.
    if (text.toString().length === 0 && initialContent.length > 0) {
      doc.transact(() => {
        text.insert(0, initialContent);
      });
    }
  };
  provider.on("sync", () => {
    initializeFromContent();
    notify();
  });

  return {
    doc,
    provider,
    text,
    peers,
    destroy: () => {
      // Provider teardown clears awareness states and the socket.
      provider.destroy();
      doc.destroy();
    },
  };
};
