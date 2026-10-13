import React from 'react';
import { Application, deleteApplication, updateApplication } from '../lib/api';

const STATUS_COLORS: Record<string, string> = {
  saved: 'var(--color-info-bg)',
  applied: 'var(--color-primary-100)',
  interview: 'var(--color-warning-bg)',
  offer: 'var(--color-success-bg)',
  rejected: 'var(--color-danger-bg)',
  withdrawn: 'var(--color-neutral-100)',
};

export interface TrackerProps {
  applications: Application[];
  onChange: () => void;
  requireAuth?: () => boolean;
  authed?: boolean;
  onLogin?: () => void;
}

const STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'] as const;

export const Tracker: React.FC<TrackerProps> = ({ applications, onChange, requireAuth, authed, onLogin }) => {
  const [filter, setFilter] = React.useState<string>('all');
  const [editingNotes, setEditingNotes] = React.useState<string | null>(null);
  const [notesDraft, setNotesDraft] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: applications.length };
    for (const s of STATUSES) c[s] = applications.filter((a) => a.status === s).length;
    return c;
  }, [applications]);
  const visible = filter === 'all' ? applications : applications.filter((a) => a.status === filter);

  const setStatus = async (id: string, status: string) => {
    if (requireAuth && !requireAuth()) return;
    await updateApplication(id, { status });
    onChange();
  };

  const saveNotes = async (id: string) => {
    if (requireAuth && !requireAuth()) return;
    await updateApplication(id, { notes: notesDraft });
    setEditingNotes(null);
    onChange();
  };

  const remove = async (id: string) => {
    if (requireAuth && !requireAuth()) return;
    await deleteApplication(id);
    setConfirmDelete(null);
    onChange();
  };

  if (!authed) {
    return (
      <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <div className="empty-state">
          <div className="empty-icon">🔐</div>
          <h3>Log in to track applications</h3>
          <p>Your tracked jobs sync to your account so they follow you across devices.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }} onClick={onLogin}>
            Log in / Sign up
          </button>
        </div>
      </div>
    );
  }

  if (!applications.length) {
    return (
      <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No tracked jobs yet</h3>
          <p>Apply or save any job above — it will appear here with its status. Track before deployment or after, your history carries over.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="chips" style={{ marginBottom: 'var(--space-4)' }}>
        {['all', ...STATUSES].map((s) => (
          <button key={s} className={`chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s} ({counts[s] || 0})
          </button>
        ))}
      </div>
      <div className="grid" style={{ gap: 'var(--space-3)' }}>
        {visible.map((a) => (
          <div key={a.id} className="card" style={{ padding: 'var(--space-4)', borderLeft: `4px solid var(--color-primary-400)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div className="card-title" style={{ fontSize: 'var(--text-base)' }}>{a.snapshot?.title || a.opportunity_id}</div>
                <div className="card-company" style={{ fontSize: 'var(--text-sm)' }}>{a.snapshot?.company} · {a.snapshot?.location}</div>
              </div>
              <span className="badge" style={{ background: STATUS_COLORS[a.status] || 'var(--color-neutral-100)' }}>{a.status}</span>
            </div>
            {a.notes && editingNotes !== a.id && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)', marginBottom: 0 }}>📝 {a.notes}</p>
            )}
            {editingNotes === a.id ? (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <input value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Cover note, referral, deadline…" aria-label="Application notes" style={{ fontSize: 'var(--text-sm)' }} />
                <button className="btn btn-primary btn-sm" onClick={() => saveNotes(a.id)}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingNotes(null)}>Cancel</button>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)', alignItems: 'center' }}>
              <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} style={{ width: 'auto', padding: 'var(--space-2)' }} aria-label="Update status">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditingNotes(a.id); setNotesDraft(a.notes || ''); }}>
                {a.notes ? 'Edit note' : 'Add note'}
              </button>
              {a.snapshot?.url && <a className="btn btn-ghost btn-sm" href={a.snapshot.url} target="_blank" rel="noopener noreferrer">Open listing ↗</a>}
              {confirmDelete === a.id ? (
                <span style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--text-xs)' }}>Withdraw?</span>
                  <button className="btn btn-primary btn-sm" onClick={() => remove(a.id)}>Yes</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Keep</button>
                </span>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(a.id)}>Withdraw</button>
              )}
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginLeft: 'auto' }}>
                {new Date(a.applied_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
