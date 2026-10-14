import React, { useId } from 'react';

export interface LogoProps {
  variant?: 'mark' | 'full';
  size?: number;
  withTagline?: boolean;
}

/**
 * MPUZA signature logo. "MPUZA" means "connect me".
 * The Connection M — two people (you <-> your opportunity) linked by the M path,
 * with a Connection Spark where they meet, plus a teal link line bridging
 * campus to career underneath.
 * The `mark` is inlined so CSS can animate the spark (it pulses brighter when
 * the navbar brand is hovered). Keep in sync with public/mpuza-mark.svg.
 */
export const Logo: React.FC<LogoProps> = ({ variant = 'mark', size = 40, withTagline = false }) => {
  const reactId = useId();
  const id = (name: string) => `mpuza${name}${reactId.replace(/:/g, '')}`;

  if (variant === 'full') {
    return (
      <img
        src="/mpuza-logo.svg"
        alt="MPUZA — Connect me. Campus to Career"
        width={size * 3.75}
        height={size}
        style={{ display: 'block', height: size, width: 'auto' }}
        draggable={false}
      />
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size * 0.27,
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgb(194 65 12 / 0.28), inset 0 0 0 1px rgb(255 255 255 / 0.35)',
        flexShrink: 0,
      }}
    >
      <svg
        className="mpuza-mark"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 96 96"
        role="img"
        aria-label={withTagline ? 'MPUZA — Connect me. Campus to Career' : 'MPUZA — connect me'}
        width={size}
        height={size}
        style={{ display: 'block', width: size, height: size }}
      >
        <defs>
          <linearGradient id={id('Grad')} x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFB25A" />
            <stop offset="0.48" stopColor="#F97316" />
            <stop offset="0.78" stopColor="#C2410C" />
            <stop offset="1" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id={id('Sheen')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
            <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <clipPath id={id('Clip')}>
            <rect x="4" y="4" width="88" height="88" rx="26" />
          </clipPath>
          <radialGradient id={id('Glow')} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#FFF7ED" stopOpacity="0.85" />
            <stop offset="1" stopColor="#FFF7ED" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Squircle base */}
        <rect x="4" y="4" width="88" height="88" rx="26" fill={`url(#${id('Grad')})`} />
        <rect x="4" y="4" width="88" height="88" rx="26" fill={`url(#${id('Sheen')})`} />
        <g clipPath={`url(#${id('Clip')})`}>
          <ellipse cx="78" cy="82" rx="42" ry="30" fill="#0F766E" opacity="0.35" />
          <ellipse cx="18" cy="18" rx="30" ry="22" fill="#FFFFFF" opacity="0.14" />
        </g>
        <rect x="4.75" y="4.75" width="86.5" height="86.5" rx="25" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="1.5" />
        {/* "Connect Me" M: the link path between the two people */}
        <path d="M22 69 L22 30 L40 52 L58 28 L74 28" fill="none" stroke="#FFFFFF" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Person 1 (you) standing on the left peak */}
        <circle cx="22" cy="20" r="4.6" fill="#FFF7ED" />
        <path d="M15.8 31.2 C15.8 26.2 18.4 23.6 22 23.6 C25.6 23.6 28.2 26.2 28.2 31.2 Z" fill="#FFF7ED" />
        {/* Person 2 (your opportunity) standing on the right end */}
        <circle cx="74" cy="17.5" r="4.6" fill="#FFF7ED" />
        <path d="M67.8 28.7 C67.8 23.7 70.4 21.1 74 21.1 C77.6 21.1 80.2 23.7 80.2 28.7 Z" fill="#FFF7ED" />
        {/* Connection Spark: the "connect me" moment (animated via CSS) */}
        <g className="mpuza-spark">
          <circle cx="40" cy="34" r="11" fill={`url(#${id('Glow')})`} />
          <path d="M40 26.5 C41.4 31.3 44.7 34.6 49.5 36 C44.7 37.4 41.4 40.7 40 45.5 C38.6 40.7 35.3 37.4 30.5 36 C35.3 34.6 38.6 31.3 40 26.5 Z" fill="#FFF7ED" />
        </g>
        {/* Link line: the campus-to-career connection bridging both feet */}
        <path d="M22 69 Q48 79 74 58" fill="none" stroke="#5EEAD4" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
      </svg>
    </span>
  );
};
