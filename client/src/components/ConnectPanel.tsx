import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  type ChatMessage,
  type Member,
  type LiveProfile,
  type RecorderHandle,
  listMembers,
  fetchConversation,
  fetchUnread,
  markConversationRead,
  postMessage,
  signedMediaUrl,
  loadLocalHistory,
  saveLocalHistory,
  joinLive,
  liveReady,
  onLive,
  onPresence,
  broadcastMessage,
  startRecording,
  uploadNote,
} from '../lib/connect';

/**
 * ConnectPanel — the messenger hub: member directory + real-time 1:1 chat
 * with text, voice notes and video notes, plus buttons to start calls
 * (WebRTC lives in CallOverlay, driven by window events).
 *
 * Opened by the navbar "Connect" button (window event `mpuza:connect-open`)
 * and by other components. Publishes unread totals via `mpuza:unread`.
 */

const fmtTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const fmtDuration = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function mergeMessages(...lists: ChatMessage[][]): ChatMessage[] {
  const seen = new Map<string, ChatMessage>();
  for (const list of lists) {
    for (const m of list) if (m?.id && !seen.has(m.id)) seen.set(m.id, m);
  }
  return [...seen.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export const ConnectPanel: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [online, setOnline] = useState<LiveProfile[]>([]);
  const [peer, setPeer] = useState<Member | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // recorder state
  const [recording, setRecording] = useState<'voice' | 'video' | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const [pending, setPending] = useState<{ blob: Blob; mime: string; durationMs: number; url: string; kind: 'voice' | 'video' } | null>(null);
  const recRef = useRef<RecorderHandle | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const onlineSet = useMemo(() => new Set(online.map((o) => o.id)), [online]);
  const totalUnread = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread]);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 4000);
  }, []);

  // ---- open/close via window events (navbar, hero, etc.) --------------
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener('mpuza:connect-open', onOpen);
    window.addEventListener('mpuza:connect-close', onClose);
    return () => {
      window.removeEventListener('mpuza:connect-open', onOpen);
      window.removeEventListener('mpuza:connect-close', onClose);
    };
  }, []);

  // ---- publish unread totals for the navbar badge ---------------------
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mpuza:unread', { detail: { total: totalUnread, counts: unread } }));
  }, [unread, totalUnread]);

  // ---- join presence + listen for live messages -----------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await joinLive({ id: user.id, name: user.name });
      if (cancelled) return;
      const offMsg = onLive((payload) => {
        if (payload.event !== 'msg') return;
        const msg = payload as unknown as ChatMessage;
        if (!msg?.id || msg.sender_id === user.id) return; // ignore own echo
        if (msg.recipient_id !== user.id) return;
        setUnread((u) => ({ ...u, [msg.sender_id]: (u[msg.sender_id] || 0) + 1 }));
        if (msg.sender_id === peerRef.current?.id) {
          setMessages((prev) => mergeMessages(prev, [msg]));
        }
      });
      const offPresence = onPresence((users) => {
        if (!cancelled) setOnline(users);
      });
      offRef.current = [offMsg, offPresence];
    })();
    return () => {
      cancelled = true;
      offRef.current?.forEach((f) => { try { f(); } catch { /* noop */ } });
      offRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.name]);

  const peerRef = useRef<Member | null>(null);
  const offRef = useRef<Array<() => void> | null>(null);
  useEffect(() => { peerRef.current = peer; }, [peer]);

  // ---- members + unread polling ---------------------------------------
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = async () => {
      try {
        const [users, counts] = await Promise.all([listMembers('', user.id), fetchUnread(user.id)]);
        if (!alive) return;
        setMembers(users);
        setUnread((prev) => ({ ...counts, ...prev }));
      } catch { /* offline */ }
    };
    load();
    const t = window.setInterval(load, 20000);
    return () => { alive = false; window.clearInterval(t); };
  }, [user?.id]);

  // ---- load conversation when peer changes (+ light polling fallback) --
  useEffect(() => {
    if (!user || !peer) { setMessages([]); return; }
    let alive = true;
    markConversationRead(user.id, peer.id);
    const load = async () => {
      try {
        const { messages: rows } = await fetchConversation(user.id, peer.id);
        if (!alive) return;
        const local = loadLocalHistory(user.id, peer.id);
        setMessages(mergeMessages(rows, local));
        setUnread((u) => { if (!u[peer.id]) return u; const n = { ...u }; delete n[peer.id]; return n; });
      } catch { /* offline */ }
    };
    load();
    // Poll only while realtime isn't confirmed — otherwise live pushes win.
    const t = window.setInterval(() => { if (!liveReady()) load(); }, 4000);
    return () => { alive = false; window.clearInterval(t); };
  }, [user?.id, peer?.id]);

  // auto-scroll to newest
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, peer?.id]);

  // ---- send helpers ----------------------------------------------------
  const persistLocal = useCallback((msg: ChatMessage) => {
    if (!user || !peer) return;
    saveLocalHistory(user.id, peer.id, mergeMessages(loadLocalHistory(user.id, peer.id), [msg]));
  }, [user?.id, peer?.id]);

  const deliver = useCallback((msg: ChatMessage) => {
    setMessages((prev) => mergeMessages(prev, [msg]));
    persistLocal(msg);
    broadcastMessage(msg);
  }, [persistLocal]);

  const sendText = useCallback(async () => {
    const body = draft.trim();
    if (!body || !user || !peer || busy) return;
    setBusy(true);
    setDraft('');
    try {
      const msg = await postMessage({
        sender_id: user.id,
        sender_name: user.name,
        recipient_id: peer.id,
        kind: 'text',
        body,
      });
      deliver(msg);
    } catch (e) {
      setDraft(body);
      showNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [draft, user, peer, busy, deliver, showNotice]);

  const sendPending = useCallback(async () => {
    if (!pending || !user || !peer || busy) return;
    setBusy(true);
    try {
      const path = await uploadNote(pending.blob, user.id, pending.mime);
      const msg = await postMessage({
        sender_id: user.id,
        sender_name: user.name,
        recipient_id: peer.id,
        kind: pending.kind,
        media_path: path,
        media_mime: pending.mime,
        duration_ms: pending.durationMs,
      });
      deliver(msg);
      URL.revokeObjectURL(pending.url);
      setPending(null);
    } catch (e) {
      showNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [pending, user, peer, busy, deliver, showNotice]);


  // ---- recorder --------------------------------------------------------
  const stopRecTimer = () => {
    if (recTimerRef.current) { window.clearInterval(recTimerRef.current); recTimerRef.current = null; }
  };

  const startRec = useCallback((mode: 'voice' | 'video') => {
    if (recording || pending) return;
    setRecSeconds(0);
    const handle = startRecording(
      mode,
      ({ blob, mime, durationMs }) => {
        stopRecTimer();
        setRecording(null);
        setPending({ blob, mime, durationMs, url: URL.createObjectURL(blob), kind: mode });
      },
      (err) => {
        stopRecTimer();
        setRecording(null);
        showNotice(err.message);
      },
    );
    if (!handle) return;
    recRef.current = handle;
    setRecording(mode);
    recTimerRef.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
  }, [recording, pending, showNotice]);

  const cancelRec = useCallback(() => {
    recRef.current?.cancel();
    recRef.current = null;
    stopRecTimer();
    setRecording(null);
  }, []);

  const finishRec = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const discardPending = useCallback(() => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
  }, [pending]);

  // resolve signed urls for stored notes that only know media_path
  useEffect(() => {
    if (!open || !peer) return;
    let alive = true;
    (async () => {
      const unresolved = messages.filter((m) => m.media_path && !m.media_url);
      for (const m of unresolved) {
        const url = await signedMediaUrl(m.media_path as string);
        if (!alive || !url) continue;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, media_url: url } : x)));
      }
    })();
    return () => { alive = false; };
  }, [messages, open, peer?.id]);


  const startCall = (kind: 'video' | 'audio') => {
    if (!peer) return;
    window.dispatchEvent(new CustomEvent('mpuza:call-start', { detail: { peer, kind } }));
  };

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q),
    );
  }, [members, query]);

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        className="connect-fab"
        aria-label={open ? 'Close messages' : 'Open messages'}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="connect-fab-icon">{open ? '✕' : '💬'}</span>
        {!open && totalUnread > 0 && <span className="connect-fab-badge">{totalUnread > 9 ? '9+' : totalUnread}</span>}
      </button>

      {open && (
        <div className="connect-panel" role="dialog" aria-label="Connect — messages">
          <header className="connect-head">
            {peer ? (
              <>
                <button type="button" className="connect-back" onClick={() => setPeer(null)} aria-label="Back to members">
                  ←
                </button>
                <div className="connect-peer">
                  <span className="connect-avatar">{(peer.name || '?').charAt(0).toUpperCase()}</span>
                  <div>
                    <div className="connect-peer-name">{peer.name}</div>
                    <div className="connect-peer-status">
                      {onlineSet.has(peer.id) ? '● online' : 'offline'}
                    </div>
                  </div>
                </div>
                <div className="connect-actions">
                  <button type="button" className="connect-action" title="Audio call" onClick={() => startCall('audio')}>📞</button>
                  <button type="button" className="connect-action" title="Video call" onClick={() => startCall('video')}>📹</button>
                </div>
              </>
            ) : (
              <>
                <div className="connect-peer">
                  <span className="connect-avatar brand">MP</span>
                  <div>
                    <div className="connect-peer-name">Connect</div>
                    <div className="connect-peer-status">chat • voice notes • video notes • calls</div>
                  </div>
                </div>
                <button type="button" className="connect-back" onClick={() => setOpen(false)} aria-label="Close">
                  ✕
                </button>
              </>
            )}
          </header>

          {!user ? (
            <div className="connect-empty">
              <div className="empty-icon">🔑</div>
              <h4>Log in to connect</h4>
              <p>Chat, send voice &amp; video notes, and call other members in real time.</p>
            </div>
          ) : !peer ? (
            <div className="connect-body">
              <input
                className="connect-search"
                placeholder="Search members…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search members"
              />
              <div className="connect-list">
                {filteredMembers.length === 0 && (
                  <div className="connect-empty small">
                    <p>No other members yet — be the first to say hi once friends join.</p>
                  </div>
                )}
                {filteredMembers.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 hover:border-primary-300"
                    onClick={() => setPeer(m)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center space-y-1 flex-shrink-0">
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${onlineSet.has(m.id) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {(m.name || '?').charAt(0).toUpperCase()}
                        </span>
                        {unread[m.id] && (
                          <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                            {unread[m.id]} new
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 truncate">{m.name}</span>
                          {m.hireable && (
                            <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                              Hiring
                            </span>
                          )}
                        </div>
                        {m.title && <div className="text-sm text-gray-600 truncate">{m.title}</div>}
                        {m.company_name && <div className="text-sm text-primary-600 font-medium truncate">{m.company_name}</div>}
                        {m.email && <div className="text-xs text-gray-400 truncate">{m.email}</div>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (

            <div className="connect-body">
              <div className="connect-msgs" ref={scrollRef}>
                {messages.length === 0 && (
                  <div className="connect-empty small">
                    <p>Say hello 👋 — or send a voice / video note right from the composer.</p>
                  </div>
                )}
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`msg ${mine ? 'mine' : ''}`}>
                      {!mine && <div className="msg-from">{m.sender_name || 'Member'}</div>}
                      {m.kind === 'text' && <div className="msg-bubble">{m.body}</div>}
                      {m.kind === 'voice' && (
                        <div className="msg-bubble media">
                          {m.media_url ? (
                            <audio controls preload="metadata" src={m.media_url} />
                          ) : (
                            <span className="msg-media-pending">🎙 voice note {m.duration_ms ? `· ${fmtDuration(m.duration_ms)}` : ''}</span>
                          )}
                        </div>
                      )}
                      {m.kind === 'video' && (
                        <div className="msg-bubble media video">
                          {m.media_url ? (
                            <video controls preload="metadata" src={m.media_url} />
                          ) : (
                            <span className="msg-media-pending">🎬 video note {m.duration_ms ? `· ${fmtDuration(m.duration_ms)}` : ''}</span>
                          )}
                        </div>
                      )}
                      <div className="msg-time">{fmtTime(m.created_at)}</div>
                    </div>
                  );
                })}
              </div>

              {notice && <div className="connect-notice">{notice}</div>}

              {recording && (
                <div className="recorder-bar">
                  <span className="rec-dot" />
                  <span className="rec-time">{fmtDuration(recSeconds * 1000)}</span>
                  <span className="rec-hint">{recording === 'video' ? 'Recording video…' : 'Recording voice…'}</span>
                  <button type="button" className="rec-btn stop" onClick={finishRec} title="Stop &amp; review">■</button>
                  <button type="button" className="rec-btn" onClick={cancelRec} title="Discard">✕</button>
                </div>
              )}

              {pending && (
                <div className="pending-bar">
                  {pending.kind === 'voice' ? (
                    <audio controls preload="metadata" src={pending.url} />
                  ) : (
                    <video controls preload="metadata" src={pending.url} className="pending-video" />
                  )}
                  <div className="pending-actions">
                    <span className="pending-label">
                      {pending.kind === 'voice' ? '🎙 Voice note' : '🎬 Video note'} · {fmtDuration(pending.durationMs)}
                    </span>
                    <button type="button" className="btn btn-primary btn-sm" onClick={sendPending} disabled={busy}>
                      {busy ? 'Sending…' : 'Send'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={discardPending} disabled={busy}>
                      Discard
                    </button>
                  </div>
                </div>
              )}

              {!recording && !pending && (
                <div className="composer">
                  <button
                    type="button"
                    className="composer-btn"
                    title="Record a voice note"
                    aria-label="Record a voice note"
                    onClick={() => startRec('voice')}
                  >
                    🎙
                  </button>
                  <button
                    type="button"
                    className="composer-btn"
                    title="Record a video note"
                    aria-label="Record a video note"
                    onClick={() => startRec('video')}
                  >
                    🎥
                  </button>
                  <input
                    className="composer-input"
                    placeholder={`Message ${peer.name}…`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendText(); } }}
                    aria-label="Message text"
                  />
                  <button
                    type="button"
                    className="composer-send"
                    onClick={() => void sendText()}
                    disabled={!draft.trim() || busy}
                    aria-label="Send message"
                  >
                    ➤
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

