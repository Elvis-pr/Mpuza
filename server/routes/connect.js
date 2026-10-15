/**
 * MPUZA - Connect API (the "Connect" suite: chat, presence config, media)
 *
 * Endpoints:
 *   GET  /api/connect/config      - Supabase URL + anon key for the client
 *                                    (realtime presence/broadcast + direct
 *                                    Storage uploads of voice/video notes)
 *   GET  /api/connect/users?q=    - directory of members (id, name, email)
 *   GET  /api/connect/messages    - conversation history (?me=&peer=) with
 *                                    signed media URLs + marks read
 *   GET  /api/connect/unread      - unread counts per peer (?me=)
 *   POST /api/connect/messages    - send a text / voice / video message
 *   POST /api/connect/messages/read - mark conversation read
 *   GET  /api/connect/media?path= - signed URL for a stored media object
 *
 * Persistence: Supabase table `messages` (see server/seed.sql). When the
 * table has not been created yet the API degrades gracefully to
 * `ephemeral: true` — the client keeps history in localStorage and delivers
 * live via Supabase Realtime broadcast, so chat still works end-to-end.
 *
 * Media: uploaded by the client directly to the existing private bucket
 * `application-docs` under chat/… (anon INSERT policy already exists), so
 * Vercel's 4.5MB request body limit never applies. Files are served only
 * through signed URLs minted here — never directly public.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const BUCKET = 'application-docs';

function getSupabase() {
  try {
    const { supabase } = require('../supabase');
    return supabase || null;
  } catch { return null; }
}

function isMissingTable(error) {
  return error && (error.code === '42P01' || /relation .* does not exist/i.test(error.message || ''));
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

/** Only chat/… object paths inside our bucket may be signed. */
function isSafeMediaPath(p) {
  return typeof p === 'string' && p.startsWith('chat/') && !p.includes('..') && p.length < 400;
}

/** Mint short-lived signed URLs for rows that carry media. */
async function withSignedUrls(sb, rows) {
  if (!sb) return rows;
  const out = [];
  for (const row of rows) {
    if (row.media_path && isSafeMediaPath(row.media_path)) {


      try {
        const { data } = await sb.storage.from(BUCKET).createSignedUrl(row.media_path, 3600);
        out.push({ ...row, media_url: data?.signedUrl || null });
        continue;
      } catch { /* fall through with no url */ }
    }
    out.push(row);
  }
  return out;
}

// GET /api/connect/config — public anon config the browser needs for
// Supabase Realtime (presence + broadcast) and direct Storage uploads.
router.get('/config', (req, res) => {
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  const looksPlaceholder =
    !url || !anonKey ||
    url.includes('your-project-id') || anonKey.includes('your-anon-key') ||
    !/^https:\/\//.test(url);
  if (looksPlaceholder) {
    return res.json({ success: false, configured: false });
  }
  res.json({ success: true, configured: true, url, anonKey, bucket: BUCKET });
});

// GET /api/connect/users?q= — member directory for starting conversations.
router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const me = String(req.query.me || '');
  try {
    const sb = getSupabase();
    let rows = [];
    if (sb) {
      const { data, error } = await sb
        .from('profiles')
        .select('id, name, avatar_url, title, company_id, company_name, hireable, contacts, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error && !isMissingTable(error)) throw error;
      rows = data || [];
    } else {
      // Local fallback: same file auth-store writes when Supabase is off.
      try {
        const fs = require('fs');
        const path = require('path');
        const file = path.join(__dirname, '..', 'data', 'users.json');
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        rows = (j.users || []).map((u) => ({ id: u.id, name: u.name, email: u.email, created_at: u.created_at, avatar_url: u.avatar_url, title: u.title || null, company_id: u.company_id || null, company_name: u.company_name || null, hireable: u.hireable || false, contacts: u.contacts || {}, profile_url: "/profiles/" + u.id }));
      } catch { rows = []; }
    }
    if (me) rows = rows.filter((u) => u.id !== me);
    if (q) {
      rows = rows.filter(
        (u) =>

          String(u.name || '').toLowerCase().includes(q) ||
          String(u.email || '').toLowerCase().includes(q),
      );
    }
    res.json({ success: true, users: rows });
  } catch (err) {
    console.error('❌ Connect users error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/connect/messages?me=&peer= — full conversation, oldest first.
// Inbound messages are marked read as a side effect (opening the thread).
router.get('/messages', async (req, res) => {
  const me = String(req.query.me || '');
  const peer = String(req.query.peer || '');
  if (!me || !peer) return badRequest(res, 'me and peer are required');
  try {
    const sb = getSupabase();
    if (!sb) return res.json({ success: true, messages: [], ephemeral: true });

    const { data, error } = await sb
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${me})`)
      .order('created_at', { ascending: true })
      .limit(300);
    if (error && isMissingTable(error)) {
      return res.json({ success: true, messages: [], ephemeral: true });
    }
    if (error) throw error;

    // Best-effort read receipt for inbound messages.
    try {
      await sb
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', me)
        .eq('sender_id', peer)
        .is('read_at', null);
    } catch { /* non-fatal */ }

    const rows = await withSignedUrls(sb, data || []);
    res.json({ success: true, messages: rows });
  } catch (err) {
    console.error('❌ Connect messages error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});



// GET /api/connect/unread?me= — { [peerId]: n } for navbar badges.
router.get('/unread', async (req, res) => {
  const me = String(req.query.me || '');
  if (!me) return badRequest(res, 'me is required');
  try {
    const sb = getSupabase();
    if (!sb) return res.json({ success: true, counts: {} });
    const { data, error } = await sb
      .from('messages')
      .select('sender_id')
      .eq('recipient_id', me)
      .is('read_at', null);
    if (error && isMissingTable(error)) return res.json({ success: true, counts: {} });
    if (error) throw error;
    const counts = {};
    for (const row of data || []) counts[row.sender_id] = (counts[row.sender_id] || 0) + 1;
    res.json({ success: true, counts });
  } catch (err) {
    console.error('❌ Connect unread error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/connect/messages — send. Body: { sender_id, sender_name?,
// recipient_id, kind?, body?, media_path?, media_mime?, duration_ms? }
router.post('/messages', async (req, res) => {
  const { sender_id, sender_name, recipient_id } = req.body || {};
  const kind = String(req.body?.kind || 'text');
  const body = String(req.body?.body || '').slice(0, 4000);
  const mediaPath = req.body?.media_path ? String(req.body.media_path) : null;
  const mediaMime = req.body?.media_mime ? String(req.body.media_mime) : null;
  const durationMs = Number.isFinite(Number(req.body?.duration_ms)) ? Number(req.body.duration_ms) : null;

  if (!sender_id || !recipient_id) return badRequest(res, 'sender_id and recipient_id are required');
  if (!['text', 'voice', 'video', 'image'].includes(kind)) return badRequest(res, 'invalid kind');
  if (kind === 'text' && !body.trim()) return badRequest(res, 'message body is required');
  if (kind !== 'text' && (!mediaPath || !isSafeMediaPath(mediaPath))) {
    return badRequest(res, 'valid media_path required');
  }
  if (mediaPath && !isSafeMediaPath(mediaPath)) return badRequest(res, 'invalid media_path');

  const row = {
    id: newId('msg'),
    sender_id: String(sender_id),
    sender_name: sender_name ? String(sender_name).slice(0, 60) : null,
    recipient_id: String(recipient_id),
    kind,
    body: body || null,
    media_path: mediaPath,
    media_mime: mediaMime,
    duration_ms: durationMs,
    created_at: new Date().toISOString(),
  };

  try {
    const sb = getSupabase();
    if (!sb) return res.json({ success: true, message: row, ephemeral: true });

    const { data, error } = await sb.from('messages').insert(row).select().single();
    if (error && isMissingTable(error)) {
      // Table not migrated yet: client still delivers it live via Realtime
      // broadcast and keeps history locally (see client/src/lib/connect.ts).
      return res.json({ success: true, message: row, ephemeral: true });
    }
    if (error) throw error;
    const [signed] = await withSignedUrls(sb, [data]);
    res.json({ success: true, message: signed });
  } catch (err) {
    console.error('❌ Connect send error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});


// POST /api/connect/messages/read — mark inbound thread read.
router.post('/messages/read', async (req, res) => {
  const me = String(req.body?.me || '');
  const peer = String(req.body?.peer || '');
  if (!me || !peer) return badRequest(res, 'me and peer are required');
  try {
    const sb = getSupabase();
    if (!sb) return res.json({ success: true });
    const { error } = await sb
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', me)
      .eq('sender_id', peer)
      .is('read_at', null);
    if (error && isMissingTable(error)) return res.json({ success: true });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Connect read error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/connect/media?path= — 1h signed URL for a stored voice/video note.
router.get('/media', async (req, res) => {
  const p = String(req.query.path || '');
  if (!isSafeMediaPath(p)) return badRequest(res, 'invalid path');
  try {
    const sb = getSupabase();
    if (!sb) return res.status(404).json({ success: false, message: 'Storage not configured' });
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(p, 3600);
    if (error) throw error;
    res.json({ success: true, url: data.signedUrl });
  } catch (err) {
    console.error('❌ Connect media error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

