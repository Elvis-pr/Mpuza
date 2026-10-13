import React from 'react';
import type { Opportunity } from '../types';

export interface JobDetailModalProps {
  job: Opportunity | null;
  applied?: boolean;
  onClose: () => void;
  onApply: (opp: Opportunity) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, applied, onClose, onApply }) => {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  if (!job) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={`${job.title} details`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgb(41 37 36 / 0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div className="card" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: '100%', maxHeight: '88vh', overflow: 'auto', padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <div>
            <span className={`badge ${job.type === 'internship' ? 'badge-internship' : 'badge-fulltime'}`}>{job.type}</span>
            {job.external && <span className="badge" style={{ background: 'var(--color-success-bg)', color: '#047857', marginLeft: 8 }}>Live · {job.source}</span>}
            <h2 style={{ marginTop: 'var(--space-3)' }}>{job.title}</h2>
            <div className="card-company">{job.company} · {job.location}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="card-desc" style={{ marginTop: 'var(--space-4)', whiteSpace: 'pre-wrap' }}>{job.description}</p>
        {!!job.requirements?.length && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <strong>Requirements</strong>
            <ul style={{ marginTop: 'var(--space-2)' }}>{job.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
        <div className="card-meta" style={{ marginTop: 'var(--space-3)' }}>
          <span>💰 {job.pay}</span><span>📅 {job.deadline}</span>
          {job.category && <span>🏷️ {job.category}</span>}
        </div>
        <div className="card-actions">
          {job.external && job.url ? (
            <a className="btn btn-primary btn-sm" href={job.url} target="_blank" rel="noopener noreferrer" onClick={() => onApply(job)}>
              {applied ? '✓ Tracked — Apply on site' : 'Apply on company site ↗'}
            </a>
          ) : (
            <button className="btn btn-primary btn-sm" disabled={applied} onClick={() => onApply(job)}>
              {applied ? '✓ Applied' : 'Apply now'}
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
        </div>
        {job.external && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginTop: 'var(--space-3)' }}>External listing — applying opens the employer's site in a new tab. We track it in My Applications so you never lose it.</p>}
      </div>
    </div>
  );
};
