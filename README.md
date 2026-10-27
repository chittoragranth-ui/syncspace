# SyncSpace

SyncSpace is a small real-time collaboration MVP: every room has a shared Yjs-backed canvas and rich-text document, relayed by a separate Socket.IO server.

## Requirements

- Node.js 20.9 or newer
- npm

## Start both applications

```bash
npm install
npm run dev
```

The Next.js app runs at [http://localhost:3000](http://localhost:3000), and the collaboration server runs at [http://localhost:4000](http://localhost:4000). The server health endpoint is `http://localhost:4000/health`.

For separate terminals, use `npm run dev:web` and `npm run dev:server`. To build the web client, run `npm run build`.

## Test with two participants

1. Open `http://localhost:3000` and click **Create a room**.
2. Click **Invite** in the room header and copy the URL.
3. Open that URL in a second browser, private window, or separate browser profile.
4. Draw on the whiteboard and type in Shared notes. Confirm the other participant sees both changes and the participant list updates.
5. Move the pointer over the canvas to see the other participant's live cursor.
6. Temporarily stop the server or disconnect one browser from the network. Restore connectivity; the client reconnects and synchronizes using Yjs state-vector/diff updates.

## Implementation notes

- Canvas shapes are stored in the room's Yjs `shapes` map, with draw order in `shapeOrder`.
- Editor content is bound to the `editor` Y.XmlFragment through Tiptap Collaboration. StarterKit history is disabled in favor of collaborative history.
- The server keeps one in-memory Y.Doc and Awareness instance per active room. This MVP does not persist rooms across server restarts.
- Room IDs are shareable links; there is no authentication or access control in this prototype.
