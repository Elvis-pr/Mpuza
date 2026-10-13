import type { CareerResource, OpportunitiesResponse } from '../types';

const API = '/api';
const PROFILE_ID = 'local-user';

function profileId(): string {
  try {
    let id = localStorage.getItem('mpuza-profile-id');
    if (!id) {
      id = PROFILE_ID;
      localStorage.setItem('mpuza-profile-id', id);
    }
    return id;
  } catch { return PROFILE_ID; }
}

/**
 * API client for the MPUZA backend.
 * Merged source: curated (Supabase/local) + LIVE (Remotive/Arbeitnow).
 */

export interface LiveMeta {
  enabled: boolean;
  count: number;
  cached: boolean;
  error: string | null;
}

export type JobSource = 'all' | 'curated' | 'live';

export type JobRegion = 'all' | 'rwanda';

export async function listOpportunities({
  q = '',
  type = 'all',
  source = 'all',
  region = 'all',
}: {
  q?: string;
  type?: 'all' | 'internship' | 'fulltime';
  source?: JobSource;
  region?: JobRegion;
}): Promise<OpportunitiesResponse & { live?: LiveMeta }> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (type !== 'all') params.set('type', type);
  if (source !== 'all') params.set('source', source);
  if (region !== 'all') params.set('region', region);
  const query = params.toString();
  const res = await fetch(`${API}/opportunities?${query}`);
  return res.json();
}

export async function listResources(): Promise<CareerResource[]> {
  const res = await fetch(`${API}/opportunities?source=curated`);
  const data = await res.json();
  return data.resources ?? [];
}

export async function matchOpportunities(profile: unknown, region: JobRegion = 'all') {
  const params = new URLSearchParams();
  params.set('studentProfile', JSON.stringify(profile));
  if (region !== 'all') params.set('region', region);
  const res = await fetch(`${API}/opportunities/match?${params.toString()}`);
  return res.json();
}

export interface Application {
  id: string;
  profile_id: string;
  opportunity_id: string;
  status: string;
  applied_at: string;
  updated_at?: string;
  notes?: string;
  snapshot?: { title: string; company: string; location: string; url?: string; source?: string } | null;
}

export async function listApplications(): Promise<{ success: boolean; applications: Application[] }> {
  const res = await fetch(`${API}/applications?profileId=${encodeURIComponent(profileId())}`);
  return res.json();
}

export async function createApplication(opportunityId: string, snapshot?: Application['snapshot'], notes?: string) {
  const res = await fetch(`${API}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opportunity_id: opportunityId, profileId: profileId(), snapshot, notes }),
  });
  return res.json();
}

export async function updateApplication(id: string, patch: { status?: string; notes?: string }) {
  const res = await fetch(`${API}/applications/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return res.json();
}

export function getProfileId() { return profileId(); }

