import express from "express";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import * as Y from "yjs";
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
type Room = { doc: Y.Doc; awareness: Awareness; participants: Map<string, Set<number>> };
const rooms = new Map<string, Room>();

function getRoom(id: string): Room {
  let room = rooms.get(id);
  if (!room) {
    const doc = new Y.Doc();
    room = { doc, awareness: new Awareness(doc), participants: new Map() };
    rooms.set(id, room);
  }
  return room;
}

const app = express();
app.get("/health", (_req, res) => res.json({ status: "ok", rooms: rooms.size }));
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: [CLIENT_ORIGIN, "http://localhost:3001"], methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e7,
});

io.on("connection", (socket: Socket) => {
  let roomId: string | undefined;
  let room: Room | undefined;
  socket.on("join-room", (payload: { roomId?: string; stateVector?: Uint8Array }) => {
    if (!payload?.roomId || typeof payload.roomId !== "string" || payload.roomId.length > 100) {
      socket.emit("connection-error", "A valid room ID is required.");
      return;
    }
    if (roomId && roomId !== payload.roomId) socket.leave(roomId);
    roomId = payload.roomId;
    room = getRoom(roomId);
    socket.join(roomId);
    const clientVector = payload.stateVector ? new Uint8Array(payload.stateVector) : undefined;
    socket.emit("sync", Y.encodeStateAsUpdate(room.doc, clientVector));
    const states = [...room.awareness.getStates().keys()];
    if (states.length) socket.emit("awareness", encodeAwarenessUpdate(room.awareness, states));
    socket.emit("room-joined", { roomId });
  });
  socket.on("update", (update: Uint8Array) => {
    if (!room || !roomId || !(update instanceof Uint8Array)) return;
    try {
      Y.applyUpdate(room.doc, update, socket);
      socket.to(roomId).emit("update", update);
    } catch (error) {
      socket.emit("connection-error", "Could not apply a collaboration update.");
      console.error("Invalid Yjs update", error);
    }
  });
  socket.on("awareness", (payload: { update?: Uint8Array; clientId?: number }) => {
    const update = payload?.update;
    const clientId = payload?.clientId;
    if (!room || !roomId || !(update instanceof Uint8Array) || typeof clientId !== "number" || !Number.isSafeInteger(clientId)) return;
    try {
      applyAwarenessUpdate(room.awareness, update, socket);
      const known = room.participants.get(socket.id) ?? new Set<number>();
      known.add(clientId);
      room.participants.set(socket.id, known);
      socket.to(roomId).emit("awareness", update);
    } catch (error) {
      socket.emit("connection-error", "Could not apply a presence update.");
      console.error("Invalid awareness update", error);
    }
  });
  socket.on("cursor", (cursor: { x: number; y: number; name: string; color: string }) => {
    if (!roomId || !cursor || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) return;
    socket.to(roomId).emit("cursor", { ...cursor, socketId: socket.id });
  });
  socket.on("disconnect", () => {
    if (!room || !roomId) return;
    const clients = [...(room.participants.get(socket.id) ?? [])];
    if (clients.length) {
      removeAwarenessStates(room.awareness, clients, socket);
      socket.to(roomId).emit("awareness", encodeAwarenessUpdate(room.awareness, clients));
    }
    room.participants.delete(socket.id);
    socket.to(roomId).emit("cursor-left", socket.id);
  });
});



httpServer.listen(PORT, () => {
  console.log(`SyncSpace collaboration server listening on http://localhost:${PORT}`);
});
