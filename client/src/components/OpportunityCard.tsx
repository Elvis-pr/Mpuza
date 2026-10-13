import React from 'react';
import type { Opportunity } from '../types';

export interface OpportunityCardProps {
  opportunity: Opportunity;
  applied?: boolean;
  saved?: boolean;
  onApply: (opp: Opportunity) => void;
  onSave: (opp: Opportunity) => void;
  onDetails: (opp: Opportunity) => void;
}

function sourceLabel(opp: Opportunity): string | null {
  if (opp.source === 'remotive') return '● Live · Remotive';
  if (opp.source === 'arbeitnow') return '● Live · Arbeitnow';
  if (opp.external) return '● Live';
  return null;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity, applied, saved, onApply, onSave, onDetails }) => {
  const live = sourceLabel(opportunity);
  return (
    <article className="card opp-card">
      <div className="opp-card-top">
        <span className={`badge ${opportunity.type === 'internship' ? 'badge-internship' : 'badge-fulltime'}`}>
          {opportunity.type === 'internship' ? 'Internship' : 'Full-Time'}
        </span>
        <span className="card-location">
          <span>&#128205;</span> {opportunity.location}
        </span>
      </div>

      <div className="card-title">{opportunity.title}</div>
      <div className="card-company">{opportunity.company} {live && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 700, marginLeft: 6 }}>{live}</span>}</div>

      <p className="card-desc">{opportunity.description?.slice(0, 160)}{(opportunity.description?.length || 0) > 160 ? '…' : ''}</p>

      <div className="card-meta">
        <span>&#128176; {opportunity.pay}</span>
        <span>&#128197; {opportunity.deadline}</span>
      </div>

      <div className="card-actions">
        <button className={`btn btn-sm ${applied ? 'btn-secondary' : 'btn-primary'}`} onClick={() => onApply(opportunity)} disabled={applied}>
          {applied ? '✓ Applied' : opportunity.external ? 'Apply externally' : 'Apply'}
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => onDetails(opportunity)}>
          Details
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onSave(opportunity)} aria-label="Save job">
          {saved ? '★ Saved' : '☆ Save'}
        </button>
      </div>
    </article>
  );
};

