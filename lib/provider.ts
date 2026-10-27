"use client";

import { io, Socket } from "socket.io-client";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";

export type UserProfile = { name: string; color: string };
export type Cursor = UserProfile & { x: number; y: number; socketId: string };

const colors = ["#f47e63", "#6f8de8", "#54a78b", "#bb79ce", "#e5a84b", "#3da8b5"];
const names = ["Riley", "Jordan", "Casey", "Avery", "Morgan", "Taylor", "Quinn", "Skyler"];
function makeProfile(): UserProfile {
  return {
    name: `${names[Math.floor(Math.random() * names.length)]} ${Math.floor(10 + Math.random() * 89)}`,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

type Listener = () => void;
export class RoomProvider {
  readonly doc = new Y.Doc();
  readonly awareness = new Awareness(this.doc);
  readonly socket: Socket;
  readonly profile = makeProfile();
  readonly cursors = new Map<string, Cursor>();
  status: "connecting" | "connected" | "offline" | "error" = "connecting";
  error?: string;
  private listeners = new Set<Listener>();
  private joined = false;
  private lastCursorSent = 0;
  private updateHandler: (update: Uint8Array, origin: unknown) => void;
  private awarenessHandler: (change: unknown, origin: unknown) => void;

  constructor(readonly roomId: string) {
    this.awareness.setLocalStateField("user", this.profile);
    this.socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
    this.updateHandler = (update, origin) => {
      if (origin !== "remote" && this.socket.connected && this.joined) this.socket.emit("update", update);
    };
    this.awarenessHandler = (_change, origin) => {
      if (origin !== "remote" && this.socket.connected && this.joined) {
        const clients = [this.doc.clientID];
        this.socket.emit("awareness", { update: encodeAwarenessUpdate(this.awareness, clients), clientId: this.doc.clientID });
      }
      this.notify();
    };
    this.doc.on("update", this.updateHandler);
    this.awareness.on("update", this.awarenessHandler);
    this.socket.on("connect", this.onConnect);
    this.socket.on("disconnect", this.onDisconnect);
    this.socket.on("connect_error", this.onConnectError);
    window.addEventListener("offline", this.onNetworkOffline);
    window.addEventListener("online", this.onNetworkOnline);
    this.socket.on("sync", this.onSync);
    this.socket.on("update", this.onUpdate);
    this.socket.on("awareness", this.onAwareness);
    this.socket.on("room-joined", () => { this.joined = true; this.setStatus("connected"); });
    this.socket.on("connection-error", (message: string) => { this.error = message; this.setStatus("error"); });
    this.socket.on("cursor", this.onCursor);
    this.socket.on("cursor-left", this.onCursorLeft);
    this.socket.connect();
  }

  private onConnect = () => {
    this.joined = false;
    this.setStatus("connecting");
    this.socket.emit("join-room", { roomId: this.roomId, stateVector: Y.encodeStateVector(this.doc) });
  };
  private onDisconnect = () => { this.joined = false; this.setStatus("offline"); };
  private onConnectError = () => { this.setStatus("offline"); };
  private onNetworkOffline = () => this.setStatus("offline");
  private onNetworkOnline = () => {
    this.joined = false;
    this.setStatus("connecting");
    this.socket.disconnect();
    this.socket.connect();
  };
  private onSync = (update: Uint8Array) => {
    Y.applyUpdate(this.doc, new Uint8Array(update), "remote");
    this.joined = true;
    this.setStatus("connected");
    this.socket.emit("update", Y.encodeStateAsUpdate(this.doc));
    const localState = this.awareness.getLocalState();
    if (localState) this.socket.emit("awareness", { update: encodeAwarenessUpdate(this.awareness, [this.doc.clientID]), clientId: this.doc.clientID });
  };
  private onUpdate = (update: Uint8Array) => Y.applyUpdate(this.doc, new Uint8Array(update), "remote");
  private onAwareness = (update: Uint8Array) => applyAwarenessUpdate(this.awareness, new Uint8Array(update), "remote");
  private onCursor = (cursor: Cursor) => {
    this.cursors.set(cursor.socketId, cursor);
    this.notify();
  };
  private onCursorLeft = (socketId: string) => { this.cursors.delete(socketId); this.notify(); };

  sendCursor(x: number, y: number) {
    const now = performance.now();
    if (!this.socket.connected || !this.joined || now - this.lastCursorSent < 16) return;
    this.lastCursorSent = now;
    this.socket.emit("cursor", { x, y, ...this.profile });
  }
  subscribe(listener: Listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify() { this.listeners.forEach((listener) => listener()); }
  private setStatus(status: RoomProvider["status"]) {
    if (this.status === status) return;
    this.status = status;
    this.notify();
  }
  destroy() {
    this.socket.disconnect();
    window.removeEventListener("offline", this.onNetworkOffline);
    window.removeEventListener("online", this.onNetworkOnline);
    this.doc.off("update", this.updateHandler);
    this.awareness.off("update", this.awarenessHandler);
    this.awareness.destroy();
    this.doc.destroy();
    this.listeners.clear();
  }
}

type Ref = { provider: RoomProvider; count: number; timer?: ReturnType<typeof setTimeout> };
const providers = new Map<string, Ref>();
export function acquireProvider(roomId: string): RoomProvider {
  let ref = providers.get(roomId);
  if (!ref) {
    ref = { provider: new RoomProvider(roomId), count: 0 };
    providers.set(roomId, ref);
  }
  if (ref.timer) clearTimeout(ref.timer);
  ref.count += 1;
  return ref.provider;
}
export function releaseProvider(roomId: string) {
  const ref = providers.get(roomId);
  if (!ref) return;
  ref.count -= 1;
  if (ref.count <= 0) ref.timer = setTimeout(() => {
    const current = providers.get(roomId);
    if (current && current.count <= 0) {
      current.provider.destroy();
      providers.delete(roomId);
    }
  }, 1000);
}
