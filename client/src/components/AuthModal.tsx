import React, { useState } from 'react';
import { useAuth } from '../lib/auth';

export interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, initialMode = 'login', onClose, onSuccess }) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (open) { setMode(initialMode); setError(null); setBusy(false); }
  }, [open, initialMode]);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && !name.trim()) { setError('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      const res = mode === 'login'
        ? await login(email.trim(), password)
        : await register(name.trim(), email.trim(), password);
      if (!res.ok) { setError(res.message || 'Something went wrong.'); return; }
      onSuccess?.(); onClose();
    } finally { setBusy(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={mode === 'login' ? 'Log in' : 'Create account'}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgb(41 37 36 / 0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div className="card scale-in" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, width: '100%', padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-2xl)' }}>{mode === 'login' ? 'Welcome back 👋' : 'Join MPUZA 🎓'}</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 0 }}>
              {mode === 'login' ? 'Log in to sync applications across devices.' : 'One account — track, match, grow.'}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="chips" style={{ marginTop: 'var(--space-4)' }}>
          <button type="button" className={`chip ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(null); }}>Log in</button>
          <button type="button" className={`chip ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(null); }}>Create account</button>
        </div>
        <form onSubmit={submit} style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
          {mode === 'register' && (
            <div><label htmlFor="auth-name">Full name</label>
              <input id="auth-name" type="text" autoComplete="name" placeholder="e.g. Aline Uwase" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div><label htmlFor="auth-email">Email</label>
            <input id="auth-email" type="email" autoComplete="email" placeholder="you@campus.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div><label htmlFor="auth-password">Password</label>
            <input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Your password' : 'Min. 6 characters'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && (
            <div role="alert" style={{ padding: 'var(--space-3)', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: 'var(--text-sm)' }}>{error}</div>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginTop: 'var(--space-4)', marginBottom: 0 }}>
          {mode === 'login' ? 'New here? ' : 'Have an account? '}
          <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary-600)', fontWeight: 700, cursor: 'pointer', font: 'inherit' }}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
};
