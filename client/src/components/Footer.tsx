import React from 'react';
import { StoryMark } from './Logo';

/**
 * Footer: warm, friendly, and minimal — with signature brand.
 */

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <StoryMark size={30} />
          <span className="brand-name" style={{ color: 'white', fontFamily: 'var(--font-display)' }}>
            MPUZA <span>.</span>
          </span>
        </div>

        <ul className="footer-links">
          <li><a href="#home">Home</a></li>
          <li><a href="#opportunities">Opportunities</a></li>
          <li><a href="#career-hub">Career Hub</a></li>
        </ul>

        <p className="footer-copy">
          &copy; {new Date().getFullYear()} MPUZA. Making campus-to-career transitions easier.
        </p>
      </div>
    </footer>
  );
};
