"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function createRoomId() {
  return Math.random().toString(36).slice(2, 8) + "-" + Math.random().toString(36).slice(2, 6);
}

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <main className="landing">
      <nav className="landing-nav"><a className="brand" href="/"> <span className="brand-mark">s</span> syncspace</a><span className="nav-note">A little more in sync.</span></nav>
      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR TEAM, IN THE SAME ROOM</div>
        <h1>Good ideas happen<br /><span>in the same space.</span></h1>
        <p className="hero-copy">A shared whiteboard and doc for thinking out loud, making a mess, and finding the good stuff together.</p>
        <button className="create-button" disabled={creating} onClick={() => { setCreating(true); router.push(`/room/${createRoomId()}`); }}>
          {creating ? "Making your space…" : "Create a room"} <span aria-hidden="true">→</span>
        </button>
        <div className="hero-foot"><span className="avatar-stack"><i>J</i><i>M</i><i>A</i></span><span>Just you and your ideas — invite everyone else with a link.</span></div>
      </section>
      <div className="preview" aria-hidden="true">
        <div className="preview-toolbar"><span className="preview-pill active">✎</span><span className="preview-pill">▱</span><span className="preview-pill">◯</span><span className="preview-divider" /><span className="preview-color" /><span className="preview-size" /></div>
        <svg className="preview-art" viewBox="0 0 760 240" fill="none"><path d="M92 124c34-61 70 44 110-12 30-42 45 38 79-2" stroke="#fd8e74" strokeWidth="4" strokeLinecap="round"/><rect x="358" y="52" width="145" height="90" rx="8" stroke="#8d8ae9" strokeWidth="3" transform="rotate(-5 358 52)"/><ellipse cx="614" cy="114" rx="65" ry="48" stroke="#73b9a2" strokeWidth="3"/><path d="m554 185 19-17 20 17 20-18 17 18" stroke="#f4b764" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="595" cy="160" r="4" fill="#f4b764"/></svg>
        <div className="preview-note note-one">What if we start with the feeling?</div><div className="preview-note note-two">big energy ✨</div><div className="preview-cursor"><span>Jordan</span><b /></div>
      </div>
      <footer className="landing-footer"><span>MADE FOR THE MOMENT BEFORE IT CLICKS</span><span>ONE SPACE. TWO WAYS TO THINK.</span></footer>
    </main>
  );
}
