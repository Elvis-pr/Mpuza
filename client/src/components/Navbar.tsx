import React, { useState, FormEvent } from 'react';
import { Button } from './Button';
import { Logo } from './Logo';

/**
 * Navbar with the signature MPUZA "Ascend M" brand mark.
 */

const Brand = () => (
  <div className="nav-brand">
    <Logo variant="mark" size={38} />
    <span className="brand-name">
      MPUZA <span>.</span>
    </span>
  </div>
);

const navItems = [
  { label: 'Home', section: 'home' },
  { label: 'Explore', section: 'opportunities' },
  { label: 'Career Hub', section: 'career-hub' },
];

export const Navbar: React.FC = () => {
  const [active, setActive] = useState(navItems[0].section);

  const handleNavigate = (e: FormEvent<HTMLAnchorElement>, section: string) => {
    e.preventDefault();
    setActive(section);
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="navbar" role="navigation" aria-label="Main navigation">
      <button
        className="btn btn-ghost btn-sm"
        style={{ font: 'inherit', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 'var(--radius-sm)' }}
        onClick={() => {
          setActive('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        <Brand />
      </button>

      <ul className="nav-links">
        {navItems.map((item) => (
          <li key={item.section}>
            <a
              href={`#${item.section}`}
              className={active === item.section ? 'active' : ''}
              onClick={(e) => handleNavigate(e, item.section)}
              aria-current={active === item.section ? 'page' : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>

      <div style={{ flex: 1 }} />

      <Button variant="primary" size="sm">
        Get Started
      </Button>
    </header>
  );
};
