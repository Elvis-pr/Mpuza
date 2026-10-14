import React, { useEffect, useRef, useState } from 'react';
import type { Opportunity } from '../types';
import { createApplication } from '../lib/api';
import { useAuth } from '../lib/auth';

const MAX_CV_BYTES = 2 * 1024 * 1024; // 2MB
const CV_EXT = ['.pdf', '.doc', '.docx'];

export interface ApplyModalProps {
  job: Opportunity | null;
  onClose: () => void;
  onSubmitted: () => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result); // strip data:...;base64,
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * ApplyModal: the real application form.
 * Collects applicant details, cover letter, and CV — then submits the
 * package to POST /api/applications so the application actually exists.
 */
export const ApplyModal: React.FC<ApplyModalProps> = ({ job, onClose, onSubmitted }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cover, setCover] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill from the logged-in account / last applicant
  useEffect(() => {
    if (!job) return;
    try {
      const saved = localStorage.getItem('mpuza-applicant');
      if (saved) {
        const p = JSON.parse(saved);
        setName(p.name || ''); setEmail(p.email || ''); setPhone(p.phone || '');
      }
      if (user) {
        setName((n) => n || user.name || '');
        setEmail((m) => m || user.email || '');
      }
    } catch { /* ignore */ }
  }, [job, user]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, busy]);

  if (!job) return null;

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0] || null;
    if (!file) { setCvFile(null); return; }
    const lower = file.name.toLowerCase();
    if (!CV_EXT.some((ext) => lower.endsWith(ext))) {
      setError('CV must be a PDF, DOC, or DOCX file.');
      e.target.value = '';
      setCvFile(null);
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      setError('CV must be 2MB or smaller. Export a lighter PDF and try again.');
      e.target.value = '';
      setCvFile(null);
      return;
    }
    setCvFile(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.'); return;
    }
    setBusy(true);
    try {
      let cv: { filename: string; data_base64: string } | undefined;
      if (cvFile) {
        const data_base64 = await readFileAsBase64(cvFile);
        cv = { filename: cvFile.name, data_base64 };
      }
      const res = await createApplication(
        job.id,
        { title: job.title, company: job.company, location: job.location, url: job.url, source: job.source },
        '',
        { applicant: { name: name.trim(), email: email.trim(), phone: phone.trim() }, cover_letter: cover.trim(), cv },
      );
      if (!res.success) { setError(res.message || 'Could not submit your application.'); return; }
      try { localStorage.setItem('mpuza-applicant', JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() })); } catch { /* ignore */ }
      // External jobs: after saving, open the employer site to finish there
      if (job.external && job.url) window.open(job.url, '_blank', 'noopener noreferrer');
      onSubmitted();
      onClose();
    } catch {
      setError('Something went wrong while submitting. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    border: '2px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-base)', color: 'var(--color-text)', background: 'var(--color-surface)', width: '100%',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' };


  return (
    <div role="dialog" aria-modal="true" aria-label={`Apply to ${job.title}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgb(41 37 36 / 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div className="card" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: '100%', maxHeight: '88vh', overflow: 'auto', padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 4 }}>Apply — {job.title}</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
              {job.company} · {job.location}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" disabled={busy}>✕</button>
        </div>

        <form onSubmit={submit} style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-4)' }}>
          <div>
            <label style={labelStyle} htmlFor="apply-name">Full name *</label>
            <input id="apply-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aline Uwase" autoComplete="name" required />
          </div>
          <div>
            <label style={labelStyle} htmlFor="apply-email">Email *</label>
            <input id="apply-email" type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div>
            <label style={labelStyle} htmlFor="apply-phone">Phone (optional)</label>
            <input id="apply-phone" type="tel" style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+250 7XX XXX XXX" autoComplete="tel" />
          </div>
          <div>
            <label style={labelStyle} htmlFor="apply-cover">Cover letter (optional)</label>
            <textarea id="apply-cover" style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }}
              value={cover} onChange={(e) => setCover(e.target.value)}
              placeholder="Tell them why you're a great fit…" maxLength={5000} />
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginTop: 4 }}>{cover.length}/5000</div>
          </div>
          <div>
            <label style={labelStyle} htmlFor="apply-cv">CV / Résumé (PDF, DOC, or DOCX — max 2MB)</label>
            <input ref={fileRef} id="apply-cv" type="file" accept=".pdf,.doc,.docx,application/pdf"
              onChange={onPickFile} style={{ fontSize: 'var(--text-sm)' }} />
            {cvFile && (
              <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-success)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <span>📎 {cvFile.name} ({Math.max(1, Math.round(cvFile.size / 1024))} KB)</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCvFile(null); if (fileRef.current) fileRef.current.value = ''; }}>Remove</button>
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', color: 'rgb(120 65 13)', fontSize: 'var(--text-sm)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Submitting…' : job.external ? 'Save & apply on site ↗' : 'Submit application'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
          {job.external && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', margin: 0 }}>
              This is an external listing — your application is saved to My Applications, then the employer's site opens so you can complete it there.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

