import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { onLive, broadcastCall, joinLive } from '../lib/connect';

/**
 * CallOverlay — real-time 1:1 audio / video calls (pure WebRTC, no server
 * media path): signaling rides Supabase Realtime broadcast, media flows
 * peer-to-peer. Works on Vercel serverless — no WebSocket backend needed.
 *
 * Signal kinds (all on the shared `mpuza-live` channel, filtered by `to`):
 *   invite | accept | decline | busy | offer | answer | ice | hangup
 *
 * Limitation: P2P without a TURN server — peers behind symmetric NATs may
 * fail to connect; STUN covers most home/mobile networks.
 */

type CallPhase = 'incoming' | 'outgoing' | 'active';

interface ActiveCall {
  phase: CallPhase;
  callId: string;
  peerId: string;
  peerName: string;
  kind: 'video' | 'audio';
}

interface Signal {
  event: string;
  callId?: string;
  from?: string;
  fromName?: string;
  to?: string;
  kind?: 'video' | 'audio';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

const newCallId = () => `call-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const fmtDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const CallOverlay: React.FC = () => {
  const { user } = useAuth();
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const callRef = useRef<ActiveCall | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pendingCandidateRef = useRef<RTCIceCandidateInit | null>(null);

  useEffect(() => { callRef.current = call; }, [call]);

  // ------------------------------------------------------------ media I/O
  const attachLocal = useCallback((stream: MediaStream) => {
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
  }, []);

  const teardown = useCallback(() => {
    try { pcRef.current?.close(); } catch { /* noop */ }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    pendingCandidateRef.current = null;
    setCall(null);
    setSeconds(0);
    setMuted(false);
    setCamOff(false);
    setError(null);
  }, []);

  const ensurePeer = useCallback((callId: string): RTCPeerConnection => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        broadcastCall({ event: 'ice', callId, to: callRef.current?.peerId, from: user?.id, candidate: e.candidate.toJSON() });
      }
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') setError('Connection failed — the other person may be behind a strict network.');
    };
    return pc;
  }, [user?.id]);


  // ------------------------------------------------------------ signaling
  useEffect(() => {
    if (!user) return;
    void joinLive({ id: user.id, name: user.name });

    const off = onLive(async (payload) => {
      if (payload.event !== 'call') return;
      const sig = payload as unknown as Signal;
      if (!sig || sig.from === user.id) return;
      const active = callRef.current;

      try {
        switch (sig.event) {
          case 'invite': {
            if (sig.to !== user.id) return;
            if (active) { // already talking → polite busy
              broadcastCall({ event: 'busy', callId: sig.callId, to: sig.from, from: user.id });
              return;
            }
            setCall({
              phase: 'incoming',
              callId: sig.callId!,
              peerId: sig.from!,
              peerName: sig.fromName || 'Member',
              kind: sig.kind || 'video',
            });
            break;
          }
          case 'accept': {
            if (!active || active.phase !== 'outgoing' || sig.callId !== active.callId) return;
            const pc = ensurePeer(active.callId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            broadcastCall({ event: 'offer', callId: active.callId, to: active.peerId, from: user.id, sdp: offer });
            setCall({ ...active, phase: 'active' });
            setSeconds(0);
            break;
          }
          case 'offer': {
            if (!active || sig.callId !== active.callId || sig.to !== user.id) return;
            const pc = ensurePeer(active.callId);
            await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp!));
            if (pendingCandidateRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(pendingCandidateRef.current));
              pendingCandidateRef.current = null;
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            broadcastCall({ event: 'answer', callId: active.callId, to: active.peerId, from: user.id, sdp: answer });
            setCall({ ...active, phase: 'active' });
            setSeconds(0);
            break;
          }
          case 'answer': {
            if (!active || sig.callId !== active.callId || sig.to !== user.id) return;
            const pc = ensurePeer(active.callId);
            await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp!));
            if (pendingCandidateRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(pendingCandidateRef.current));
              pendingCandidateRef.current = null;
            }
            setCall({ ...active, phase: 'active' });
            setSeconds(0);
            break;
          }
          case 'ice': {
            if (!active || sig.callId !== active.callId || sig.to !== user.id) return;
            const pc = pcRef.current;
            if (pc && pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(sig.candidate!));
            else pendingCandidateRef.current = sig.candidate!;
            break;
          }
          case 'decline':
          case 'busy':
          case 'hangup': {
            if (!active || (sig.callId && sig.callId !== active.callId)) return;
            if (sig.event !== 'hangup') setError(sig.event === 'busy' ? 'They are on another call.' : 'Call ended.');
            teardown();
            if (sig.event !== 'hangup') window.setTimeout(() => setError(null), 3500);
            break;
          }
        }
      } catch (e) {
        setError((e as Error).message || 'Call error');
        teardown();
      }
    });
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ------------------------------------------------------------ call timer
  useEffect(() => {
    if (call?.phase !== 'active') return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [call?.phase]);

  // The <video> elements only mount once the call is active, so re-attach
  // the already-granted streams when the stage appears.
  useEffect(() => {
    if (call?.phase !== 'active') return;
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [call?.phase, call?.kind]);


  const getMedia = useCallback(async (kind: 'video' | 'audio'): Promise<MediaStream> => {
    return navigator.mediaDevices.getUserMedia(
      kind === 'video' ? { video: { width: 640, height: 480 }, audio: true } : { audio: true },
    );
  }, []);

  // ------------------------------------------------------------ actions
  // A peer + kind dispatched by ConnectPanel via `mpuza:call-start`.
  const callTargetRef = useRef<{ id: string; name: string } | null>(null);

  const startCall = useCallback(async (kind: 'video' | 'audio') => {
    if (!user || callRef.current) return;
    const target = callTargetRef.current;
    if (!target) return;
    try {
      const stream = await getMedia(kind);
      attachLocal(stream);
      const callId = newCallId();
      setCall({ phase: 'outgoing', callId, peerId: target.id, peerName: target.name, kind });
      broadcastCall({ event: 'invite', callId, to: target.id, from: user.id, fromName: user.name, kind });
    } catch (e) {
      setError((e as Error).message || 'Camera/microphone permission denied.');
      window.setTimeout(() => setError(null), 4000);
    }
  }, [user, getMedia, attachLocal]);

  useEffect(() => {
    const onRequest = (e: Event) => {
      const detail = (e as CustomEvent).detail as { peer?: { id: string; name: string }; kind?: 'video' | 'audio' };
      if (!detail?.peer || !user) return;
      callTargetRef.current = detail.peer;
      void startCall(detail.kind || 'video');
    };
    window.addEventListener('mpuza:call-start', onRequest);
    return () => window.removeEventListener('mpuza:call-start', onRequest);
  }, [startCall, user]);

  const declineCall = useCallback(() => {
    const active = callRef.current;
    if (active) broadcastCall({ event: 'decline', callId: active.callId, to: active.peerId, from: user?.id });
    teardown();
  }, [teardown, user?.id]);

  const acceptCall = useCallback(async () => {
    const active = callRef.current;
    if (!active) return;
    try {
      const stream = await getMedia(active.kind);
      attachLocal(stream);
      ensurePeer(active.callId);
      broadcastCall({ event: 'accept', callId: active.callId, to: active.peerId, from: user?.id });
      setCall({ ...active, phase: 'active' });
      setSeconds(0);
    } catch (e) {
      setError((e as Error).message || 'Camera/microphone permission denied.');
      declineCall();
    }
  }, [getMedia, attachLocal, ensurePeer, user?.id, declineCall]);

  const hangUp = useCallback(() => {
    const active = callRef.current;
    if (active) broadcastCall({ event: 'hangup', callId: active.callId, to: active.peerId, from: user?.id });
    teardown();
  }, [teardown, user?.id]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const toggleCam = useCallback(() => {
    const next = !camOff;
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next; });
    setCamOff(next);
  }, [camOff]);


  if (!user) return null;

  if (!call) {
    if (!error) return null;
    return (
      <div className="call-toast" role="status">
        {error}
      </div>
    );
  }

  const isVideo = call.kind === 'video';

  return (
    <div className="call-overlay" role="dialog" aria-label={`Call with ${call.peerName}`}>
      <div className={`call-card ${call.phase === 'active' && isVideo ? 'wide' : ''}`}>
        <div className="call-head">
          <span className="call-avatar">{call.peerName.charAt(0).toUpperCase()}</span>
          <div>
            <div className="call-name">{call.peerName}</div>
            <div className="call-status">
              {call.phase === 'incoming' && `Incoming ${call.kind} call…`}
              {call.phase === 'outgoing' && 'Ringing…'}
              {call.phase === 'active' && (isVideo ? fmtDuration(seconds) : `🎙 audio · ${fmtDuration(seconds)}`)}
            </div>
          </div>
        </div>

        {call.phase === 'active' && (
          <div className="call-stage">
            {isVideo ? (
              <>
                <video ref={remoteVideoRef} className="call-remote" autoPlay playsInline />
                <video ref={localVideoRef} className="call-pip" autoPlay playsInline muted />
              </>
            ) : (
              <div className="call-audio-stage">
                <span className="call-avatar xl">{call.peerName.charAt(0).toUpperCase()}</span>
                <span className="call-wave" aria-hidden="true">〜〜〜</span>
                <video ref={localVideoRef} className="call-hidden" autoPlay playsInline muted />
                <video ref={remoteVideoRef} className="call-hidden" autoPlay playsInline />
              </div>
            )}
          </div>
        )}

        {error && <div className="call-error">{error}</div>}

        <div className="call-controls">
          {call.phase === 'incoming' && (
            <>
              <button type="button" className="call-btn accept" onClick={() => void acceptCall()} aria-label="Accept call">
                📞
              </button>
              <button type="button" className="call-btn decline" onClick={declineCall} aria-label="Decline call">
                ✕
              </button>
            </>
          )}

          {call.phase === 'outgoing' && (
            <button type="button" className="call-btn decline" onClick={hangUp} aria-label="Cancel call">
              ✕
            </button>
          )}

          {call.phase === 'active' && (
            <>
              <button
                type="button"
                className={`call-btn ${muted ? 'off' : ''}`}
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? '🔇' : '🎤'}
              </button>
              {isVideo && (
                <button
                  type="button"
                  className={`call-btn ${camOff ? 'off' : ''}`}
                  onClick={toggleCam}
                  aria-label={camOff ? 'Turn camera on' : 'Turn camera off'}
                >
                  {camOff ? '📷' : '🎥'}
                </button>
              )}
              <button type="button" className="call-btn decline" onClick={hangUp} aria-label="Hang up">
                ☎️
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

