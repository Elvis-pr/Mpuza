import React from 'react';
import { Opportunity, OpportunityFilters } from '../types';
import { JobRegion, matchOpportunities } from '../lib/api';
import { loadProfile } from './ProfileSection';

export interface MatchSectionProps {
  filters: OpportunityFilters;
  onClose: () => void;
  onApply?: (opp: Opportunity) => void;
}

interface MatchRow {
  opportunity: Opportunity;
  match: { score: number; matchedSkills: string[]; unmatchedRequirements: string[] };
}

export const MatchSection: React.FC<MatchSectionProps> = ({ filters, onClose, onApply }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<MatchRow[]>([]);

  const run = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = loadProfile();
      if (!profile.skills.length) { setError('Add at least one skill in My profile first.'); return; }
      const region: JobRegion = filters.region === 'rwanda' ? 'rwanda' : 'all';
      const data = await matchOpportunities({ ...profile, location: profile.location || 'Remote' }, region);
      if (!data.success || !Array.isArray(data.matched)) {
        setError(data.message || 'Could not compute matches.');
        return;
      }
      setResults(data.matched.slice(0, 4));
    } catch {
      setError('Something went wrong while fetching your match.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  React.useEffect(() => { run(); }, [run]);

  return (
    <div className="fade-in-up" style={{ marginBottom: 'var(--space-8)' }}>
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h3 style={{ marginBottom: 0 }}>✨ Match me with what you actually like</h3>
            <p style={{ marginBottom: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              We&apos;ll rank opportunities by how well they fit your skills.
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={onClose}
            style={{ font: 'inherit', border: '2px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer', padding: 'var(--space-2) var(--space-3)' }}
          >
            &#10005;
          </button>
        </div>

        <div style={{ marginTop: 'var(--space-4)' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={run}
            disabled={loading}
          >
            {loading ? 'Computing...' : '✨ Find my matches'}
          </button>
        </div>

        {loading && <div style={{ marginTop: 'var(--space-3)' }}><span className="skeleton" style={{ width: '180px', height: '24px', display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} /><span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Loading your best matches...</span></div>}

        {error && (
          <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', color: 'rgb(120 65 13)' }}>
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <p style={{ marginBottom: 'var(--space-2)' }}><strong>Your top {results.length} matches</strong> — from your profile skills</p>
            <div className="grid" style={{ gap: 'var(--space-3)' }}>
              {results.map(({ opportunity: opp, match }) => (
                <div key={opp.id} className="card" style={{ padding: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <div className="card-title" style={{ fontSize: 'var(--text-sm)' }}>{opp.title}</div>
                    <span className="badge" style={{ background: 'var(--color-success-bg)', color: '#047857' }}>{Math.round(match?.score || 0)}% fit</span>
                  </div>
                  <div className="card-company" style={{ fontSize: 'var(--text-sm)' }}>{opp.company} · {opp.location}</div>
                  {!!match?.matchedSkills?.length && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      ✓ {match.matchedSkills.slice(0, 3).join(', ')}
                    </div>
                  )}
                  {onApply && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => onApply(opp)}>Apply</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
