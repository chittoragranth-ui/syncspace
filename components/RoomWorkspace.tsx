"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acquireProvider, Cursor, releaseProvider, RoomProvider } from "@/lib/provider";
import Whiteboard from "./Whiteboard";
import SharedEditor from "./SharedEditor";

export default function RoomWorkspace({ roomId }: { roomId: string }) {
  const [provider, setProvider] = useState<RoomProvider | null>(null);
  const [version, setVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const router = useRouter();
  useEffect(() => {
    const roomProvider = acquireProvider(roomId);
    setProvider(roomProvider);
    const unsubscribe = roomProvider.subscribe(() => setVersion((value) => value + 1));
    return () => { unsubscribe(); releaseProvider(roomId); };
  }, [roomId]);
  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true); setCopyError("");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError("Copy failed — copy the URL from your address bar.");
    }
  }, []);
  const participants = useMemo(() => {
    if (!provider) return [];
    return Array.from(provider.awareness.getStates().entries()).map(([id, state]) => ({
      id, user: state.user as { name?: string; color?: string } | undefined,
    })).filter((item) => item.user?.name);
  }, [provider, version]);
  if (!provider) return <main className="workspace-loading"><span className="loading-dot" /> Opening your room…</main>;
  const isConnected = provider.status === "connected";
  const cursors = Array.from(provider.cursors.values()) as Cursor[];
  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div className="workspace-brand"><Link href="/" className="brand-mark">s</Link><span className="brand-name">syncspace</span><span className="header-divider" /><button className="room-title" onClick={() => router.push("/")}>Untitled space <span>⌄</span></button></div>
        <div className="workspace-actions">
          <div className={`connection ${provider.status}`}><i />{provider.status === "connected" ? "All changes saved" : provider.status === "connecting" ? "Connecting…" : provider.status === "offline" ? "Reconnecting…" : "Connection issue"}</div>
          <div className="presence-list" aria-label={`${participants.length} participants`}>
            {participants.slice(0, 4).map(({ id, user }) => <span key={id} title={user?.name} className="participant-avatar" style={{ backgroundColor: user?.color }}>{user?.name?.slice(0, 1)}</span>)}
            {participants.length > 4 && <span className="participant-more">+{participants.length - 4}</span>}
          </div>
          <button className="invite-button" onClick={copyLink}><span>↗</span> {copied ? "Copied!" : "Invite"}</button>
        </div>
      </header>
      {provider.status === "error" && <div className="status-banner error-banner">{provider.error ?? "Unable to join this room."}</div>}
      {!isConnected && provider.status !== "error" && <div className="status-banner offline-banner"><i /> {provider.status === "offline" ? "Connection lost. Your changes will sync when you’re back online." : "Connecting to your room…"}</div>}
      {copyError && <div className="copy-error">{copyError}</div>}
      <section className="workspace-grid">
        <div className="panel board-panel">
          <div className="panel-heading"><div><span className="panel-icon board-icon">✳</span><h2>Whiteboard</h2></div><span className="panel-hint">A space to sketch it out</span></div>
          <Whiteboard provider={provider} cursors={cursors} />
        </div>
        <div className="panel editor-panel">
          <div className="panel-heading"><div><span className="panel-icon doc-icon">≡</span><h2>Shared notes</h2></div><span className="panel-hint">Ideas, in words</span></div>
          <SharedEditor provider={provider} />
        </div>
      </section>
      <footer className="workspace-footer"><span>ROOM <b>{roomId}</b></span><span>EVERY THOUGHT HAS A PLACE.</span></footer>
    </main>
  );
}
