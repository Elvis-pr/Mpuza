import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { Logo } from './Logo';
import { useAuth } from '../lib/auth';
import { AuthModal } from './AuthModal';

/**
 * Navbar with the signature MPUZA "Ascend M" brand mark + auth state.
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
  const { user, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [unread, setUnread] = useState(0);

  // Unread totals are published by ConnectPanel.
  useEffect(() => {
    const onUnread = (e: Event) => {
      const total = (e as CustomEvent).detail?.total ?? 0;
      setUnread(total);
    };
    window.addEventListener('mpuza:unread', onUnread);
    return () => window.removeEventListener('mpuza:unread', onUnread);
  }, []);

  const handleNavigate = (e: React.MouseEvent<HTMLAnchorElement>, section: string) => {
    e.preventDefault();
    setActive(section);
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthOpen(true);
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

      {/* Connect: open the messenger dock */}
      <button
        type="button"
        className="nav-connect"
        aria-label={unread > 0 ? `Open messages (${unread} unread)` : 'Open messages'}
        onClick={() => window.dispatchEvent(new CustomEvent('mpuza:connect-open'))}
      >
        <span className="nav-connect-icon">💬</span>
        <span className="nav-connect-label">Connect</span>
        {unread > 0 && <span className="nav-connect-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            title={user.email}
            style={{
              fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)',
              background: 'var(--color-primary-50)', border: '2px solid var(--color-border)',
              borderRadius: 'var(--radius-full)', padding: 'var(--space-1) var(--space-3)',
              maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            👋 {user.name}
          </span>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            Log out
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Button variant="ghost" size="sm" onClick={() => openAuth('login')}>
            Log in
          </Button>
          <Button variant="primary" size="sm" onClick={() => openAuth('register')}>
            Get Started
          </Button>
        </div>
      )}
      <AuthModal open={authOpen} initialMode={authMode} onClose={() => setAuthOpen(false)} />
    </header>
  );
};
