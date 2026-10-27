"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import { RoomProvider } from "@/lib/provider";

export default function SharedEditor({ provider }: { provider: RoomProvider }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: provider.doc, field: "editor" }),
      CollaborationCursor.configure({ provider: { awareness: provider.awareness }, user: provider.profile }),
      Placeholder.configure({ placeholder: "Start with a thought, a question, or a wonderfully messy list…" }),
    ],
    editorProps: { attributes: { class: "tiptap-content", "aria-label": "Shared notes editor" } },
  });
  return (
    <div className="editor-wrap">
      <div className="editor-toolbar">
        <button title="Bold" className={editor?.isActive("bold") ? "tool active" : "tool"} onClick={() => editor?.chain().focus().toggleBold().run()}><b>B</b></button>
        <button title="Italic" className={editor?.isActive("italic") ? "tool active" : "tool"} onClick={() => editor?.chain().focus().toggleItalic().run()}><i>I</i></button>
        <span className="toolbar-separator" />
        <button title="Heading" className={editor?.isActive("heading", { level: 2 }) ? "tool active" : "tool"} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H</button>
        <button title="Bullet list" className={editor?.isActive("bulletList") ? "tool active" : "tool"} onClick={() => editor?.chain().focus().toggleBulletList().run()}>☷</button>
        <button title="Numbered list" className={editor?.isActive("orderedList") ? "tool active" : "tool"} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1.</button>
        <span className="toolbar-spacer" /><span className="live-label"><i /> LIVE</span>
      </div>
      <EditorContent editor={editor} />
      <div className="editor-bottom"><span>Synced with everyone in this room</span><span>↗</span></div>
    </div>
  );
}
