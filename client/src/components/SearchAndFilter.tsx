import React from 'react';
import { Button } from './Button';
import { Filter, OpportunityFilters, RegionFilter } from '../types';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  internship: 'Internships',
  fulltime: 'Full-Time',
};

export interface SearchAndFilterProps {
  q: string;
  filters: OpportunityFilters;
  loading: boolean;
  onSearch: (e: React.FormEvent) => void;
  onFilter: (t: Filter) => void;
  onRegion: (r: RegionFilter) => void;
  onClearSearch: () => void;
  onToggleMatch: () => void;
  showMatch: boolean;
  onChangeQ: (value: string) => void;
}

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  q,
  filters,
  loading,
  onSearch,
  onFilter,
  onRegion,
  onClearSearch,
  onToggleMatch,
  showMatch,
  onChangeQ,
}) => {
  return (
    <div>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <form onSubmit={onSearch} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <input
              type="search"
              value={q}
              onChange={(e) => onChangeQ(e.target.value)}
              placeholder="Search by title, company, or location..."
              aria-label="Search opportunities"
              style={{ border: '2px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--color-text)', background: 'var(--color-surface)', width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              Search
            </Button>
            {q && (
              <Button type="button" variant="ghost" size="sm" onClick={onClearSearch}>
                ✕
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onToggleMatch}>
              {showMatch ? 'Hide matches' : '✨ Match me'}
            </Button>
          </div>
        </form>

        <div className="chips" style={{ marginTop: 'var(--space-3)' }}>
          {(['all', 'internship', 'fulltime'] as Filter[]).map((t) => (
            <button
              key={t}
              className={`chip ${filters.type === t ? 'active' : ''}`}
              onClick={() => onFilter(t)}
            >
              <span className="chip-icon">{t === 'all' ? '📋' : t === 'internship' ? '🤝' : '💼'}</span>
              {FILTER_LABELS[t]}
            </button>
          ))}
          <button
            className={`chip ${filters.region === 'rwanda' ? 'active' : ''}`}
            onClick={() => onRegion(filters.region === 'rwanda' ? 'all' : 'rwanda')}
            title="Show only Rwanda-based roles"
          >
            <span className="chip-icon">🇷🇼</span>
            Rwanda only
          </button>
        </div>
      </div>
    </div>
  );
};
