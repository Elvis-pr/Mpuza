/**
 * MPUZA Connect lib — real-time chat, presence, call signaling, media.
 *
 * Transport strategy (works on Vercel serverless — no WebSocket backend):
 *  - Supabase Realtime **broadcast** for instant delivery + **presence**
 *    for online status and call signaling.
 *  - REST (/api/connect) for history, unread counts and signed media URLs.
 *  - localStorage as history fallback when the `messages` table has not
 *    been migrated yet (server answers `ephemeral: true`).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { API_BASE } from './api';

export type MessageKind = 'text' | 'voice' | 'video' | 'image';

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name?: string | null;
  recipient_id: string;
  kind: MessageKind;
  body?: string | null;
  media_path?: string | null;
  media_mime?: string | null;
  duration_ms?: number | null;
  media_url?: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  title?: string;
  company_name?: string;
  hireable?: boolean;
  contacts?: Record<string, string>;
  profile_url?: string;
}

export interface ConnectConfig {
  url: string;
  anonKey: string;
  bucket: string;
}

// ---------------------------------------------------------------- config

let cfgPromise: Promise<ConnectConfig | null> | null = null;

export function getConnectConfig(): Promise<ConnectConfig | null> {
  if (!cfgPromise) {
    cfgPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/connect/config`);
        const data = await res.json();
        if (data?.success && data.configured) {
          return { url: data.url, anonKey: data.anonKey, bucket: data.bucket } as ConnectConfig;
        }
      } catch { /* offline / not configured */ }
      return null;
    })();
  }
  return cfgPromise;
}

let sbPromise: Promise<SupabaseClient | null> | null = null;

export function getConnectSupabase(): Promise<SupabaseClient | null> {
  if (!sbPromise) {
    sbPromise = (async () => {
      const cfg = await getConnectConfig();
      if (!cfg) return null;
      try { return createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } }); }
      catch { return null; }
    })();
  }
  return sbPromise;
}

// ---------------------------------------------------------------- REST

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/connect${path}`);
  return res.json() as Promise<T>;
}

export async function listMembers(q = '', me = ''): Promise<Member[]> {
  // Use the profiles endpoint which returns extended profile data
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (me) params.set('me', me);
  const data = await getJson<{ success: boolean; profiles: Member[] }>(`/profiles?${params}`);
  return data.profiles ?? [];
}

export async function fetchConversation(
  me: string,
  peer: string,
): Promise<{ messages: ChatMessage[]; ephemeral?: boolean }> {
  const params = new URLSearchParams({ me, peer });
  const data = await getJson<{ success: boolean; messages: ChatMessage[]; ephemeral?: boolean }>(
    `/messages?${params}`,
  );
  return { messages: data.messages ?? [], ephemeral: data.ephemeral };
}

export async function fetchUnread(me: string): Promise<Record<string, number>> {
  try {
    const data = await getJson<{ counts: Record<string, number> }>(`/unread?me=${encodeURIComponent(me)}`);
    return data.counts ?? {};
  } catch { return {}; }
}

export async function markConversationRead(me: string, peer: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/connect/messages/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ me, peer }),
    });
  } catch { /* best effort */ }
}

export async function postMessage(payload: {
  sender_id: string;
  sender_name?: string;
  recipient_id: string;
  kind: MessageKind;
  body?: string;
  media_path?: string;
  media_mime?: string;
  duration_ms?: number;
}): Promise<ChatMessage> {
  const res = await fetch(`${API_BASE}/connect/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),


  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to send');
  return data.message as ChatMessage;
}

/** Resolve a stored media object to a short-lived signed URL. */
export async function signedMediaUrl(path: string): Promise<string | null> {
  try {
    const data = await getJson<{ url: string }>(`/media?path=${encodeURIComponent(path)}`);
    return data.url ?? null;
  } catch { return null; }
}

// ------------------------------------------------------- local history

const LOCAL_PREFIX = 'mpuza-conv-';

export function localHistoryKey(me: string, peer: string): string {
  return `${LOCAL_PREFIX}${[me, peer].sort().join('--')}`;
}

export function loadLocalHistory(me: string, peer: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(localHistoryKey(me, peer));
    if (!raw) return [];
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? (rows as ChatMessage[]) : [];
  } catch { return []; }
}

export function saveLocalHistory(me: string, peer: string, rows: ChatMessage[]): void {
  try {
    localStorage.setItem(localHistoryKey(me, peer), JSON.stringify(rows.slice(-300)));
  } catch { /* quota */ }
}

// ------------------------------------------------------- realtime core

export interface LiveProfile { id: string; name: string }

let liveChannel: any = null;
let liveProfile: LiveProfile | null = null;
const liveListeners = new Set<(p: Record<string, unknown> & { event: string }) => void>();
const presenceListeners = new Set<(users: LiveProfile[]) => void>();

function presenceFromState(state: Record<string, LiveProfile[]>): LiveProfile[] {
  const out: LiveProfile[] = [];
  for (const key of Object.keys(state)) {
    const entries = state[key] || [];
    const last = entries[entries.length - 1];
    if (last?.id) out.push({ id: last.id, name: last.name || 'Member' });
  }
  return out;
}

/**
 * Join the shared live channel: presence (online list) + chat delivery +
 * WebRTC call signaling. Safe to call repeatedly; no-op when Supabase
 * isn't configured (caller falls back to polling).
 */
export async function joinLive(profile: LiveProfile): Promise<void> {
  const sb = await getConnectSupabase();
  if (!sb) return;
  liveProfile = profile;
  if (liveChannel) {
    try { await liveChannel.track({ ...profile }); } catch { /* noop */ }
    return;
  }
  const channel = sb.channel('mpuza-live', { config: { presence: { key: profile.id } } });
  channel
    .on('presence', { event: 'sync' }, () => {
      const users = presenceFromState(channel.presenceState());
      presenceListeners.forEach((cb) => { try { cb(users); } catch { /* noop */ } });
    })
    .on('broadcast', { event: 'msg' }, ({ payload }: { payload: Record<string, unknown> }) => {
      liveListeners.forEach((cb) => { try { cb({ ...payload, event: 'msg' }); } catch { /* noop */ } });
    })
    .on('broadcast', { event: 'call' }, ({ payload }: { payload: Record<string, unknown> }) => {
      liveListeners.forEach((cb) => { try { cb({ ...payload, event: 'call' }); } catch { /* noop */ } });
    })
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        try { await channel.track({ ...profile }); } catch { /* noop */ }
      }
    });
  liveChannel = channel;
}

export function liveReady(): boolean { return !!liveChannel; }

export function onLive(cb: (payload: Record<string, unknown> & { event: string }) => void): () => void {
  liveListeners.add(cb);
  return () => { liveListeners.delete(cb); };
}

export function onPresence(cb: (users: LiveProfile[]) => void): () => void {
  presenceListeners.add(cb);
  return () => { presenceListeners.delete(cb); };
}

/** Broadcast a chat message over the shared channel (instant delivery). */
export function broadcastMessage(message: ChatMessage): void {
  if (!liveChannel) return;
  try { liveChannel.send({ type: 'broadcast', event: 'msg', payload: { ...message, event: 'msg' } }); }
  catch { /* noop */ }
}

/** Broadcast a WebRTC call signal; only the matching peer reacts. */
export function broadcastCall(payload: Record<string, unknown>): void {
  if (!liveChannel) return;
  try { liveChannel.send({ type: 'broadcast', event: 'call', payload: { ...payload, event: 'call' } }); }
  catch { /* noop */ }
}

export function currentLiveProfile(): LiveProfile | null { return liveProfile; }


// ------------------------------------------------------- media recorder

export function pickAudioMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  const supported = options.filter((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
  return supported[0] || '';
}

export function pickVideoMime(): string {
  const options = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=h264,opus', 'video/webm', 'video/mp4'];
  const supported = options.filter((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
  return supported[0] || '';
}

export function extForMime(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg') || mime.includes('opus')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('quicktime')) return 'mov';
  return 'webm';
}

export function kindForMime(mime: string): MessageKind {
  return mime.startsWith('video/') ? 'video' : 'voice';
}

export const MAX_NOTE_BYTES = 25 * 1024 * 1024; // keep notes snappy on mobile data

/**
 * Upload a recorded note straight to Supabase Storage (chat/<sender>/…) and
 * return its object path. Bypasses the serverless body limit entirely.
 */
export async function uploadNote(blob: Blob, senderId: string, mime: string): Promise<string> {
  if (blob.size > MAX_NOTE_BYTES) throw new Error('Note is too large — keep it under 25MB.');
  const sb = await getConnectSupabase();
  const cfg = await getConnectConfig();
  if (!sb || !cfg) throw new Error('Media storage is not configured.');
  const safeId = String(senderId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'anon';
  const path = `chat/${safeId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extForMime(mime)}`;
  const { error } = await sb.storage.from(cfg.bucket).upload(path, blob, {
    contentType: mime || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export interface RecorderHandle {
  /** Stop and deliver the recording via onStop. */
  stop: () => void;
  /** Abort silently — no onStop, tracks released. */
  cancel: () => void;
}

/** Start recording; resolves onStop with { blob, mime, durationMs }. */
export function startRecording(
  mode: 'voice' | 'video',
  onStop: (result: { blob: Blob; mime: string; durationMs: number }) => void,
  onError: (err: Error) => void,
): RecorderHandle | null {
  if (typeof MediaRecorder === 'undefined') {
    onError(new Error('Recording is not supported on this device.'));
    return null;
  }
  const mime = mode === 'video' ? pickVideoMime() : pickAudioMime();
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let cancelled = false;

  const release = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };

  navigator.mediaDevices
    .getUserMedia(mode === 'video' ? { video: { width: 640, height: 480 }, audio: true } : { audio: true })
    .then((s) => {
      stream = s;
      if (cancelled) { release(); return; }
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      recorder = rec;
      const startedAt = Date.now();
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        release();
        if (cancelled) return;
        const usedMime = rec.mimeType || mime || 'audio/webm';
        onStop({ blob: new Blob(chunks, { type: usedMime }), mime: usedMime, durationMs: Date.now() - startedAt });
      };
      rec.onerror = () => { release(); if (!cancelled) onError(new Error('Recording failed.')); };
      rec.start();
    })
    .catch((e) => onError(new Error(e?.message || 'Microphone/camera permission denied.')));

  return {
    stop: () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      else { cancelled = true; release(); }
    },
    cancel: () => {
      cancelled = true;
      if (recorder) { recorder.onstop = null; recorder.ondataavailable = null; if (recorder.state !== 'inactive') recorder.stop(); }
      release();
    },
  };
}

