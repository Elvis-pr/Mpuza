import React from 'react';
import { Application, updateApplication } from '../lib/api';

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
}

const STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'] as const;

export const Tracker: React.FC<TrackerProps> = ({ applications, onChange }) => {
  const [filter, setFilter] = React.useState<string>('all');
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: applications.length };
    for (const s of STATUSES) c[s] = applications.filter((a) => a.status === s).length;
    return c;
  }, [applications]);
  const visible = filter === 'all' ? applications : applications.filter((a) => a.status === filter);

  const setStatus = async (id: string, status: string) => {
    await updateApplication(id, { status });
    onChange();
  };

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
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)', alignItems: 'center' }}>
              <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} style={{ width: 'auto', padding: 'var(--space-2)' }} aria-label="Update status">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {a.snapshot?.url && <a className="btn btn-ghost btn-sm" href={a.snapshot.url} target="_blank" rel="noopener noreferrer">Open listing ↗</a>}
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
