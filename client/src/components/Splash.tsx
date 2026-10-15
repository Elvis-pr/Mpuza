import React, { useEffect, useRef, useState } from 'react';
import { Logo } from './Logo';

/**
 * Splash: the "connect me" intro shown when the platform opens.
 *
 * Show the signature MPUZA brand mark — the exact same Logo component the
 * navbar uses — popping in, then the wordmark and tagline.
 * Then it fades out to reveal the app.
 *
 * Honors prefers-reduced-motion (skipped entirely) and can be skipped by click.
 * Plays once per session so returning visits aren't slowed down.
 */
export const Splash: React.FC = () => {
  const [state, setState] = useState<'playing' | 'leaving' | 'gone'>('playing');
  const prevOverflowRef = useRef('');

  useEffect(() => {
    // Respect reduced-motion: no splash at all.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Play the full story only once per browser session.
    const seen = (() => {
      try { return sessionStorage.getItem('mpuza-splash') === '1'; } catch { return false; }
    })();
    if (reduced || seen) {
      setState('gone');
      return;
    }
    try { sessionStorage.setItem('mpuza-splash', '1'); } catch { /* private mode */ }

    // Lock scroll while the story plays.
    prevOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const tLeave = window.setTimeout(() => setState('leaving'), 2900);
    const tGone = window.setTimeout(() => setState('gone'), 3700);
    return () => {
      window.clearTimeout(tLeave);
      window.clearTimeout(tGone);
      document.body.style.overflow = prevOverflowRef.current;
    };
  }, []);

  // Unlock scrolling as soon as the story finishes. The splash stays mounted
  // (it only returns null when gone), so the effect cleanup above would
  // otherwise never run and the body would stay scroll-locked forever.
  useEffect(() => {
    if (state === 'gone') {
      document.body.style.overflow = prevOverflowRef.current;
    }
  }, [state]);

  if (state === 'gone') return null;

  return (
    <div
      className={`splash ${state === 'leaving' ? 'splash-leaving' : ''}`}
      onClick={() => setState('leaving')}
      role="status"
      aria-label="MPUZA — connect me. Loading your campus-to-career hub."
    >
      <div className="splash-stage">
        {/* The signature "Connection M" mark — the same Logo the navbar shows. */}
        <div className="splash-logo">
          <Logo variant="mark" size={120} />
        </div>

        <div className="splash-word">
          <span className="splash-word-text">MPUZA</span>
          <span className="splash-word-dot">.</span>
        </div>
        <div className="splash-tagline">CAMPUS TO CAREER</div>
      </div>

      <button
        type="button"
        className="splash-skip"
        onClick={(e) => { e.stopPropagation(); setState('leaving'); }}
      >
        Skip
      </button>
    </div>
  );
};