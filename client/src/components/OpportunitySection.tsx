import React, { useState, useEffect, useCallback } from 'react';
import type { Opportunity, OpportunityFilters, OpportunityGrouped } from '../types';
import { Application, JobSource, LiveMeta, createApplication, listApplications, listOpportunities } from '../lib/api';
import { SearchAndFilter } from './SearchAndFilter';
import { OpportunityCard } from './OpportunityCard';
import { MatchSection } from './MatchSection';
import { JobDetailModal } from './JobDetailModal';
import { Tracker } from './Tracker';
import { Toast } from './Toast';

export interface OpportunitySectionProps { resources?: never; }
const FILTER_LABEL: Record<'all'|'internship'|'fulltime', string> = { all: 'Open Opportunities', internship: 'Internships', fulltime: 'Full-Time' };

export const OpportunitySection: React.FC<OpportunitySectionProps> = () => {
  const [filters, setFilters] = useState<OpportunityFilters>({ q: '', type: 'all' });
  const [source, setSource] = useState<JobSource>('all');
  const [query, setQuery] = useState('');
  const [grouped, setGrouped] = useState<OpportunityGrouped>({ internship: [], fulltime: [], total: 0, resources: [] });
  const [total, setTotal] = useState(0);
  const [live, setLive] = useState<LiveMeta|undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [detail, setDetail] = useState<Opportunity|null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [toast, setToast] = useState<string|null>(null);
  const [tab, setTab] = useState<'browse'|'tracked'>('browse');
  const refreshApps = useCallback(async () => { try { const d = await listApplications(); if (d.success) setApps(d.applications||[]); } catch {} }, []);
  useEffect(() => { refreshApps(); }, [refreshApps]);
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await listOpportunities({ q: filters.q, type: filters.type, source });
        if (!data.success) { setError(data.message||'Failed to load opportunities.'); return; }
        if (active) { setGrouped(data.grouped); setTotal(data.total); setLive(data.live); }
      } catch { if (active) setError('Something went wrong while loading.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [filters.q, filters.type, source]);
  const appliedIds = React.useMemo(()=>new Set(apps.filter(a=>a.status!=='saved').map(a=>a.opportunity_id)),[apps]);
  const savedIds = React.useMemo(()=>new Set(apps.filter(a=>a.status==='saved').map(a=>a.opportunity_id)),[apps]);
  const handleFilter = useCallback((t:'all'|'internship'|'fulltime')=>{ setFilters(p=>({...p,type:t})); },[]);
  const handleSearch = useCallback((e:React.FormEvent)=>{ e.preventDefault(); setFilters(p=>({...p,q:query})); },[query]);
  const handleClearSearch = useCallback(()=>{ setQuery(''); setFilters(p=>({q:'',type:p.type})); },[]);
  const snapshotOf = (opp:Opportunity)=>({ title:opp.title, company:opp.company, location:opp.location, url:opp.url, source:opp.source });
  const handleApply = useCallback(async (opp:Opportunity)=>{
    try {
      const res = await createApplication(opp.id, snapshotOf(opp));
      await refreshApps();
      if (opp.external && opp.url) { setToast(res.deduped?'Already tracked - opening employer site.':'Tracked! Opening employer site to finish applying.'); window.open(opp.url,'_blank','noopener noreferrer'); }
      else { setToast(res.deduped?'Already in My Applications.':'Application tracked in My Applications!'); }
    } catch { setToast('Could not track right now - try again.'); }
  },[refreshApps]);
  const handleSave = useCallback(async (opp:Opportunity)=>{
    try {
      const { updateApplication } = await import('../lib/api');
      const existing = apps.find(a=>a.opportunity_id===opp.id);
      if (existing) { await updateApplication(existing.id,{status:savedIds.has(opp.id)?'applied':'saved'}); }
      else { await createApplication(opp.id,snapshotOf(opp)); const d=await listApplications(); const c=(d.applications||[]).find(a=>a.opportunity_id===opp.id); if(c) await updateApplication(c.id,{status:'saved'}); }
      await refreshApps(); setToast(savedIds.has(opp.id)?'Moved to Applied.':'Saved to My Applications!');
    } catch { setToast('Could not save right now.'); }
  },[apps,refreshApps,savedIds]);
  const hasActiveFilter = filters.q!==''||filters.type!=='all';
  const allOpps=[...grouped.internship,...grouped.fulltime];
  return (
    <div>
      <div className="section-header"><h2>{FILTER_LABEL[filters.type]}</h2><p>{loading?'Loading opportunities...':error?error:`Showing ${total} opportunities${hasActiveFilter?` for "${filters.q}"`:''}${live?.enabled?` - ${live.count} live`:''}`}</p></div>
      <div className="chips" style={{marginBottom:'var(--space-4)'}}><button className={`chip ${tab==='browse'?'active':''}`} onClick={()=>setTab('browse')}>Browse jobs</button><button className={`chip ${tab==='tracked'?'active':''}`} onClick={()=>setTab('tracked')}>My Applications ({apps.length})</button></div>
      {tab==='tracked' ? (<Tracker applications={apps} onChange={refreshApps} />) : (<>
        {showMatch && <MatchSection filters={filters} onClose={()=>setShowMatch(false)} />}
        <SearchAndFilter q={query} onChangeQ={setQuery} filters={filters} loading={loading} onSearch={handleSearch} onFilter={handleFilter} onClearSearch={handleClearSearch} onToggleMatch={()=>setShowMatch(v=>!v)} showMatch={showMatch} />
        <div className="chips" style={{marginTop:'var(--space-3)'}}>{(['all','live','curated'] as JobSource[]).map(s=>(<button key={s} className={`chip ${source===s?'active':''}`} onClick={()=>setSource(s)}>{s==='all'?'All jobs':s==='live'?'Live jobs':'Curated'}</button>))}</div>
        {loading ? (<div className="card" style={{padding:'var(--space-5)',marginTop:'var(--space-4)'}}><div className="skeleton" style={{height:'16px',width:'100%'}} /><div className="skeleton" style={{height:'16px',width:'100%',marginTop:'var(--space-3)'}} /></div>) : error ? (<div className="card" style={{padding:'var(--space-5)',textAlign:'center',marginTop:'var(--space-4)'}}><p>{error}</p></div>) : allOpps.length===0 ? (<div className="card" style={{padding:'var(--space-5)',textAlign:'center',marginTop:'var(--space-4)'}}><h3>No opportunities found</h3><p>Try a different search or filter.</p></div>) : (<div className="grid grid-auto" style={{marginTop:'var(--space-4)'}}>{allOpps.map(opp=>(<OpportunityCard key={opp.id} opportunity={opp} applied={appliedIds.has(opp.id)} saved={savedIds.has(opp.id)} onApply={handleApply} onSave={handleSave} onDetails={setDetail} />))}</div>)}
      </>)}
      <JobDetailModal job={detail} applied={detail?appliedIds.has(detail.id):false} onClose={()=>setDetail(null)} onApply={handleApply} />
      {toast && <Toast message={toast} type="success" onDismiss={()=>setToast(null)} />}
    </div>
  );
};
