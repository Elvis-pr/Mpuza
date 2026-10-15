# Mpuza — Campus to Career

Mpuza ("connect me") is a modern campus-to-career platform for students: discover
internships and jobs (Rwanda-first, plus live feeds), get skill-matched roles,
track applications — **and connect for real**: real-time chat, voice notes,
video notes, and 1:1 audio/video calls, all in the browser.

## What makes Mpuza different

- **💬 Real-time chat** — 1:1 messaging with online presence and unread badges
- **🎙️ Voice notes / 🎬 video notes** — record right in the composer, delivered
  through Supabase Storage (private bucket, signed URLs)
- **📹 Video & audio calls** — pure WebRTC 1:1 calls signaled over Supabase
  Realtime (works on Vercel serverless — no extra media server)
- **🎯 Skill matching** — opportunities ranked against your profile
- **📱 Web + native** — Capacitor shells for Android and iOS
- **Consistent brand** — the same signature "Connection M" logo in the splash,
  navbar and footer

## Stack

- **Frontend**: React + Vite + TypeScript (`client/`), design tokens in
  `client/src/styles/tokens.css`
- **Backend**: Express (`server/`), deployed as a Vercel serverless function
  (`api/index.js`)
- **Data**: Supabase (Postgres + Storage + Realtime), with local JSON fallbacks
  for development

## Connect suite — one-time Supabase setup

Chat history, unread tracking and presence need the `messages` table:

1. Open **Supabase Dashboard → SQL Editor → New query**
2. Paste the **CHAT: MESSAGES** section from [`server/seed.sql`](server/seed.sql)
   (everything from `-- ==================== CHAT: MESSAGES` down to the
   `END $$;` block) and run it
3. Make sure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in the **Vercel
   project env vars** (the browser receives them via `GET /api/connect/config`
   — they are the public anon keys by design)

Until the table exists, the API gracefully degrades to `ephemeral` mode: chat
still works live between open browsers (Realtime broadcast + local history),
but history won't persist across devices.

### How realtime works (no WebSocket backend)

- Shared Supabase Realtime channel `mpuza-live` carries **presence** (online
  dots), **chat delivery** (broadcast), and **call signaling**
  (`invite/accept/offer/answer/ice/hangup`)
- Voice/video notes upload **directly from the browser** to the private
  `application-docs` bucket under `chat/…`; playback uses short-lived signed
  URLs from `GET /api/connect/media`
- Calls are peer-to-peer WebRTC (Google STUN). There is no TURN server yet, so
  peers behind symmetric NATs may occasionally fail to connect

## Development

```bash
npm install && npm --prefix client install
npm start            # Express on :4000 (serves client/dist when built)
npm run build        # build the frontend
npm run dev --prefix client   # Vite dev server
```

Key API routes: `/api/opportunities`, `/api/auth`, `/api/applications`,
`/api/connect` (config, users, messages, unread, media).

## License

ISC
