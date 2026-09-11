// Yjs relay for the companion service.
//
// Implements the y-websocket server protocol: a sync handshake on join,
// document updates fanned out through the doc's update event, and
// awareness (presence, cursors) relayed verbatim between room members.
// Documents live in memory only; Drive remains the durability layer
// through client-side snapshots.

import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

export const createRelayState = () => {
  const docs = new Map(); // room -> Y.Doc
  const connections = new Map(); // room -> Set<WebSocket>

  const getDoc = (room) => {
    let doc = docs.get(room);
    if (!doc) {
      doc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(doc);
      // The server holds no presence of its own: drop the local state
      // the constructor seeds so joiners never see a ghost participant.
      awarenessProtocol.removeAwarenessStates(
        awareness,
        [awareness.clientID],
        "server",
      );
      doc.awareness = awareness;
      docs.set(room, doc);
    }
    return doc;
  };

  return { docs, connections, getDoc };
};

/**
 * Wires one socket into a room. `onJoin`/`onLeave` report room
 * membership so callers can audit relay traffic.
 */
export const setupWSConnection = (
  ws,
  room,
  state = createRelayState(),
  hooks = {},
) => {
  const doc = state.getDoc(room);
  const clients = state.connections.get(room) ?? new Set();
  clients.add(ws);
  state.connections.set(room, clients);

  const send = (bytes) => {
    if (ws.readyState === ws.OPEN) ws.send(bytes, { binary: true });
  };

  // Fan out document updates. The origin's own listener stays silent
  // (that socket already has the data); another member's listener sends
  // to everyone in the room except the origin socket.
  const broadcastExcept = (origin, bytes) => {
    for (const peer of clients) {
      if (peer !== origin && peer.readyState === peer.OPEN) {
        peer.send(bytes, { binary: true });
      }
    }
  };

  const onUpdate = (update, origin) => {
    if (origin === ws) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    broadcastExcept(origin, encoding.toUint8Array(encoder));
  };
  doc.on("update", onUpdate);

  // Sync handshake so the newcomer catches up with the room state.
  const syncEncoder = encoding.createEncoder();
  encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(syncEncoder, doc);
  send(encoding.toUint8Array(syncEncoder));

  // Tell the newcomer who is present. Stale states age out on every
  // client through the awareness timeout, so no server-side removal
  // is needed when someone drops.
  if (doc.awareness) {
    const awareness = doc.awareness;
    const clientsKnown = [...awareness.getStates().keys()];
    if (clientsKnown.length > 0) {
      const update = awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        clientsKnown,
      );
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, update);
      send(encoding.toUint8Array(encoder));
    }
  }

  const awarenessListener = ({ added, updated, removed }, origin) => {
    if (origin === ws) return;
    const changed = [...added, ...updated, ...removed];
    if (changed.length === 0) return;
    const update = awarenessProtocol.encodeAwarenessUpdate(
      doc.awareness,
      changed,
    );
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, update);
    broadcastExcept(origin, encoding.toUint8Array(encoder));
  };

  doc.awareness.on("update", awarenessListener);
  ws.on("message", (data, isBinary) => {
    if (!isBinary) return;
    const decoder = decoding.createDecoder(new Uint8Array(data));
    try {
      const type = decoding.readVarUint(decoder);
      if (type === MESSAGE_SYNC) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
        if (encoding.length(encoder) > 1) {
          send(encoding.toUint8Array(encoder));
        }
      } else if (type === MESSAGE_AWARENESS) {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(doc.awareness, update, ws);
      }
    } catch {
      // A malformed frame must not take the room down.
    }
  });

  const cleanup = () => {
    doc.off("update", onUpdate);
    doc.awareness?.off("update", awarenessListener);
    const roomClients = state.connections.get(room);
    roomClients?.delete(ws);
    if (roomClients?.size === 0) {
      state.connections.delete(room);
      // Last peer out: tear the room down instead of holding the
      // document and its awareness timers in memory.
      state.docs.delete(room);
      doc.awareness?.destroy();
      doc.destroy();
    }
    hooks.onLeave?.(room);
  };
  ws.on("close", cleanup);
  ws.on("error", cleanup);
  hooks.onJoin?.(room);
};
