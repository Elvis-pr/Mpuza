import React from 'react';

export interface LogoProps {
  variant?: 'mark' | 'full';
  size?: number;
  withTagline?: boolean;
}

/**
 * MPUZA signature logo.
 * "Ascend M" — left peak = campus, right peak launches into an arrow = career.
 * Opportunity Dot (sun in the valley) + teal campus-to-career bridge.
 * Use `mark` in navbar/footer icon slots, `full` for hero/about/empty states.
 */
export const Logo: React.FC<LogoProps> = ({ variant = 'mark', size = 40, withTagline = false }) => {
  if (variant === 'full') {
    return (
      <img
        src="/mpuza-logo.svg"
        alt="MPUZA — Campus to Career"
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
      <img
        src="/mpuza-mark.svg"
        alt={withTagline ? 'MPUZA — Campus to Career' : 'MPUZA'}
        width={size}
        height={size}
        style={{ display: 'block', width: size, height: size }}
        draggable={false}
      />
    </span>
  );
};
