// Relay integration test: two WebSocket clients sync a shared Yjs
// document and see each other's awareness state through the companion.

import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { createCompanion } from "../src/server.mjs";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const listen = (companion) =>
  new Promise((resolve) => {
    companion.server.listen(0, () => resolve(companion.server.address().port));
  });

const settle = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

// A minimal y-websocket client: enough protocol for the test.
const makeClient = (port, room) => {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}`);
  const opened = new Promise((resolve) => ws.once("open", resolve));

  const send = (bytes) => ws.send(bytes, { binary: true });

  const sendSyncStep1 = () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(encoding.toUint8Array(encoder));
  };

  ws.on("open", () => {
    // The client initiates the handshake too, so it pulls server state.
    sendSyncStep1();
  });

  ws.on("message", (data) => {
    const decoder = decoding.createDecoder(new Uint8Array(data));
    const type = decoding.readVarUint(decoder);
    if (type === MESSAGE_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, doc, null);
      if (encoding.length(encoder) > 1) {
        send(encoding.toUint8Array(encoder));
      }
    } else if (type === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        null,
      );
    }
  });

  const publishUpdate = () => {
    // Send the latest local state as a sync update.
    const update = Y.encodeStateAsUpdate(doc);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    send(encoding.toUint8Array(encoder));
  };

  const announce = (state) => {
    awareness.setLocalState(state);
    const update = awarenessProtocol.encodeAwarenessUpdate(awareness, [
      awareness.clientID,
    ]);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, update);
    send(encoding.toUint8Array(encoder));
  };

  const close = () => {
    awareness.destroy();
    doc.destroy();
    ws.close();
  };

  return {
    doc,
    awareness,
    ws,
    opened,
    publishUpdate,
    announce,
    sendSyncStep1,
    close,
  };
};

test("two clients converge on one document through the relay", async () => {
  const companion = createCompanion({});
  const port = await listen(companion);
  const room = "file-42";

  const alice = makeClient(port, room);
  const bob = makeClient(port, room);
  await Promise.all([alice.opened, bob.opened]);
  await settle();

  // Alice types; her update reaches the room.
  alice.doc.getText("content").insert(0, "hello from alice");
  alice.publishUpdate();

  await settle();
  assert.equal(bob.doc.getText("content").toString(), "hello from alice");

  // Bob types on top; the merge converges for both.
  bob.doc.getText("content").insert(0, "bob: ");
  bob.publishUpdate();
  await settle();
  assert.equal(
    alice.doc.getText("content").toString(),
    "bob: hello from alice",
  );
  assert.equal(bob.doc.getText("content").toString(), "bob: hello from alice");

  // Awareness: Alice announces presence, Bob sees it.
  alice.announce({ user: { name: "Alice" } });
  await settle();
  const states = [...bob.awareness.getStates().entries()];
  const aliceState = states.find(([id]) => id === alice.awareness.clientID);
  assert.ok(aliceState, "Bob sees Alice's awareness state");
  assert.equal(aliceState[1].user.name, "Alice");

  alice.close();
  bob.close();
  await companion.close();
});

test("rooms are isolated from each other", async () => {
  const companion = createCompanion({});
  const port = await listen(companion);

  const one = makeClient(port, "room-1");
  const other = makeClient(port, "room-2");
  await Promise.all([one.opened, other.opened]);
  await settle();

  one.doc.getText("content").insert(0, "secret");
  one.publishUpdate();
  await settle();
  assert.equal(other.doc.getText("content").toString(), "");

  one.close();
  other.close();
  await companion.close();
});
