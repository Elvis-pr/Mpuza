import React, { useState, useEffect, useCallback } from 'react';
import type { Opportunity, OpportunityFilters, OpportunityGrouped, RegionFilter } from '../types';
import { Application, JobRegion, JobSource, LiveMeta, createApplication, listApplications, listOpportunities } from '../lib/api';
import { SearchAndFilter } from './SearchAndFilter';
import { OpportunityCard } from './OpportunityCard';
import { MatchSection } from './MatchSection';
import { ProfileSection } from './ProfileSection';
import { JobDetailModal } from './JobDetailModal';
import { Tracker } from './Tracker';
import { Toast } from './Toast';
import { useAuth } from '../lib/auth';
import { AuthModal } from './AuthModal';

export interface OpportunitySectionProps { resources?: never; }
const FILTER_LABEL: Record<'all'|'internship'|'fulltime', string> = { all: 'Open Opportunities', internship: 'Internships', fulltime: 'Full-Time' };

export const OpportunitySection: React.FC<OpportunitySectionProps> = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState<OpportunityFilters>({ q: '', type: 'all', region: 'all' });
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
  const [authOpen, setAuthOpen] = useState(false);
  const refreshApps = useCallback(async () => { try { const d = await listApplications(); if (d.success) setApps(d.applications||[]); } catch {} }, []);
  useEffect(() => { refreshApps(); }, [refreshApps, user]);
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const region: JobRegion = filters.region === 'rwanda' ? 'rwanda' : 'all';
        const data = await listOpportunities({ q: filters.q, type: filters.type, source, region });
        if (!data.success) { setError(data.message||'Failed to load opportunities.'); return; }
        if (active) { setGrouped(data.grouped); setTotal(data.total); setLive(data.live); }
      } catch { if (active) setError('Something went wrong while loading.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [filters.q, filters.type, filters.region, source]);
  const appliedIds = React.useMemo(()=>new Set(apps.filter(a=>a.status!=='saved').map(a=>a.opportunity_id)),[apps]);
  const savedIds = React.useMemo(()=>new Set(apps.filter(a=>a.status==='saved').map(a=>a.opportunity_id)),[apps]);
  const handleFilter = useCallback((t:'all'|'internship'|'fulltime')=>{ setFilters(p=>({...p,type:t})); },[]);
  const handleRegion = useCallback((r:RegionFilter)=>{ setFilters(p=>({...p,region:r})); },[]);
  const handleSearch = useCallback((e:React.FormEvent)=>{ e.preventDefault(); setFilters(p=>({...p,q:query})); },[query]);
  const handleClearSearch = useCallback(()=>{ setQuery(''); setFilters(p=>({q:'',type:p.type,region:p.region})); },[]);
  const snapshotOf = (opp:Opportunity)=>({ title:opp.title, company:opp.company, location:opp.location, url:opp.url, source:opp.source });
  const requireAuth = useCallback(() => {
    if (user) return true;
    setAuthOpen(true);
    setToast('Log in or create an account to track jobs across devices.');
    return false;
  }, [user]);
  const handleApply = useCallback(async (opp:Opportunity)=>{
    if (!requireAuth()) return;
    try {
      const res = await createApplication(opp.id, snapshotOf(opp));
      await refreshApps();
      if (opp.external && opp.url) { setToast(res.deduped?'Already tracked - opening employer site.':'Tracked! Opening employer site to finish applying.'); window.open(opp.url,'_blank','noopener noreferrer'); }
      else { setToast(res.deduped?'Already in My Applications.':'Application tracked in My Applications!'); }
    } catch { setToast('Could not track right now - try again.'); }
  },[refreshApps, requireAuth]);
  const handleSave = useCallback(async (opp:Opportunity)=>{
    if (!requireAuth()) return;
    try {
      const { updateApplication } = await import('../lib/api');
      const existing = apps.find(a=>a.opportunity_id===opp.id);
      if (existing) { await updateApplication(existing.id,{status:savedIds.has(opp.id)?'applied':'saved'}); }
      else { await createApplication(opp.id,snapshotOf(opp)); const d=await listApplications(); const c=(d.applications||[]).find(a=>a.opportunity_id===opp.id); if(c) await updateApplication(c.id,{status:'saved'}); }
      await refreshApps(); setToast(savedIds.has(opp.id)?'Moved to Applied.':'Saved to My Applications!');
    } catch { setToast('Could not save right now.'); }
  },[apps,refreshApps,savedIds,requireAuth]);
  const hasActiveFilter = filters.q!==''||filters.type!=='all'||filters.region!=='all';
  const allOpps=[...grouped.internship,...grouped.fulltime];
  return (
    <div>
      <div className="section-header"><h2>{FILTER_LABEL[filters.type]}</h2><p>{loading?'Loading opportunities...':error?error:`Showing ${total} opportunities${hasActiveFilter?` for "${filters.q}"`:''}${live?.enabled?` - ${live.count} live`:''}`}</p></div>
      {!user && (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', background: 'var(--color-primary-50)', borderColor: 'var(--color-primary-200)' }}>
          <strong>🔐 Save your progress</strong>
          <p style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>Log in to sync applications across devices. Guests track in this browser only.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setAuthOpen(true)}>Log in / Sign up</button>
        </div>
      )}
      <div className="chips" style={{marginBottom:'var(--space-4)'}}><button className={`chip ${tab==='browse'?'active':''}`} onClick={()=>setTab('browse')}>Browse jobs</button><button className={`chip ${tab==='tracked'?'active':''}`} onClick={()=>setTab('tracked')}>My Applications ({apps.length})</button></div>
      {tab==='tracked' ? (<Tracker applications={apps} onChange={refreshApps} requireAuth={requireAuth} authed={!!user} onLogin={() => setAuthOpen(true)} />) : (<>
        <ProfileSection />
        {showMatch && <MatchSection filters={filters} onClose={()=>setShowMatch(false)} onApply={(opp) => handleApply(opp)} />}
        <SearchAndFilter q={query} onChangeQ={setQuery} filters={filters} loading={loading} onSearch={handleSearch} onFilter={handleFilter} onRegion={handleRegion} onClearSearch={handleClearSearch} onToggleMatch={()=>setShowMatch(v=>!v)} showMatch={showMatch} />
        <div className="chips" style={{marginTop:'var(--space-3)'}}>{(['all','live','curated'] as JobSource[]).map(s=>(<button key={s} className={`chip ${source===s?'active':''}`} onClick={()=>setSource(s)}>{s==='all'?'All jobs':s==='live'?'Live jobs':'Curated'}</button>))}</div>
        {loading ? (<div className="card" style={{padding:'var(--space-5)',marginTop:'var(--space-4)'}}><div className="skeleton" style={{height:'16px',width:'100%'}} /><div className="skeleton" style={{height:'16px',width:'100%',marginTop:'var(--space-3)'}} /></div>) : error ? (<div className="card" style={{padding:'var(--space-5)',textAlign:'center',marginTop:'var(--space-4)'}}><p>{error}</p></div>) : allOpps.length===0 ? (<div className="card" style={{padding:'var(--space-5)',textAlign:'center',marginTop:'var(--space-4)'}}><h3>No opportunities found</h3><p>Try a different search or filter.</p></div>) : (<div className="grid grid-auto" style={{marginTop:'var(--space-4)'}}>{allOpps.map(opp=>(<OpportunityCard key={opp.id} opportunity={opp} applied={appliedIds.has(opp.id)} saved={savedIds.has(opp.id)} onApply={handleApply} onSave={handleSave} onDetails={setDetail} />))}</div>)}
      </>)}
      <JobDetailModal job={detail} applied={detail?appliedIds.has(detail.id):false} onClose={()=>setDetail(null)} onApply={handleApply} />
      <AuthModal open={authOpen} initialMode="register" onClose={() => setAuthOpen(false)} onSuccess={() => { refreshApps(); setToast('Welcome! Your applications now sync to your account.'); }} />
      {toast && <Toast message={toast} type="success" onDismiss={()=>setToast(null)} />}
    </div>
  );
};
