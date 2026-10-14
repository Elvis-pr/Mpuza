import React, { useEffect, useState } from 'react';

/**
 * Splash: the "connect me" intro shown when the platform opens.
 *
 * Tells the MPUZA story in ~3s:
 *   two people slide in from both sides -> a teal link line draws between them
 *   -> the Connection Spark lights up -> the wordmark reveals.
 * Then it fades out to reveal the app.
 *
 * Honors prefers-reduced-motion (skipped entirely) and can be skipped by click.
 * Plays once per session so returning visits aren't slowed down.
 */
export const Splash: React.FC = () => {
  const [state, setState] = useState<'playing' | 'leaving' | 'gone'>('playing');

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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const tLeave = window.setTimeout(() => setState('leaving'), 2900);
    const tGone = window.setTimeout(() => setState('gone'), 3700);
    return () => {
      window.clearTimeout(tLeave);
      window.clearTimeout(tGone);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (state === 'gone') return null;

  return (
    <div
      className={`splash ${state === 'leaving' ? 'splash-leaving' : ''}`}
      onClick={() => setState('leaving')}
      role="status"
      aria-label="MPUZA — connect me. Loading your campus-to-career hub."
    >
      <div className="splash-stage">
        <svg viewBox="0 0 320 160" className="splash-scene" aria-hidden="true">
          <defs>
            <radialGradient id="splashGlow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#FFF7ED" stopOpacity="0.9" />
              <stop offset="1" stopColor="#FFF7ED" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Person 1 — slides in from the left (you) */}
          <g className="splash-person splash-person-left" fill="#FFF7ED">
            <circle cx="96" cy="62" r="11" />
            <path d="M81 92 C81 80 87 74 96 74 C105 74 111 80 111 92 Z" />
          </g>

          {/* Person 2 — slides in from the right (your opportunity) */}
          <g className="splash-person splash-person-right" fill="#FFF7ED">
            <circle cx="224" cy="58" r="11" />
            <path d="M209 88 C209 76 215 70 224 70 C233 70 239 76 239 88 Z" />
          </g>

          {/* Link line — draws itself between them */}
          <path
            className="splash-link"
            d="M96 94 Q160 118 224 90"
            fill="none"
            stroke="#5EEAD4"
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {/* Connection Spark — lights up where they meet */}
          <g className="splash-spark-glow">
            <circle cx="160" cy="52" r="34" fill="url(#splashGlow)" />
          </g>
          <g className="splash-spark">
            <path
              d="M160 28 C162.4 36.2 167.8 41.6 176 44 C167.8 46.4 162.4 51.8 160 60 C157.6 51.8 152.2 46.4 144 44 C152.2 41.6 157.6 36.2 160 28 Z"
              fill="#FFF7ED"
            />
          </g>
        </svg>

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