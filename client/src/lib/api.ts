import type { CareerResource, OpportunitiesResponse } from '../types';

const API = '/api';
const TOKEN_KEY = 'mpuza-auth-token';

function getStoredTokenLocal(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function currentProfileId(): string {
  try {
    const u = localStorage.getItem('mpuza-auth-user');
    if (u) {
      const parsed = JSON.parse(u);
      if (parsed?.id) return String(parsed.id);
    }
  } catch {}
  try {
    let id = localStorage.getItem('mpuza-profile-id');
    if (!id) {
      id = 'guest-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('mpuza-profile-id', id);
    }
    return id;
  } catch { return 'local-user'; }
}

function authHeaders(): Record<string, string> {
  const t = getStoredTokenLocal();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Call after login/register/logout so api.ts resolves to the right owner. */
export function setAuthUser(user: { id: string } | null) {
  try {
    if (user?.id) localStorage.setItem('mpuza-auth-user', JSON.stringify({ id: user.id }));
    else localStorage.removeItem('mpuza-auth-user');
  } catch {}
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
  applicant_name?: string;
  applicant_email?: string;
  applicant_phone?: string;
  cover_letter?: string;
  cv_path?: string | null;
  cv_filename?: string | null;
}

export async function listApplications(): Promise<{ success: boolean; applications: Application[]; persistent?: boolean }> {
  const res = await fetch(`${API}/applications?profileId=${encodeURIComponent(currentProfileId())}`, {
    headers: { ...authHeaders() },
  });
  return res.json();
}

export async function createApplication(
  opportunityId: string,
  snapshot?: Application['snapshot'],
  notes?: string,
  package_?: {
    applicant: { name: string; email: string; phone?: string };
    cover_letter?: string;
    cv?: { filename: string; data_base64: string };
  },
) {
  const res = await fetch(`${API}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      opportunity_id: opportunityId,
      profileId: currentProfileId(),
      snapshot,
      notes,
      ...(package_ || {}),
    }),
  });
  return res.json();
}

/** Direct download of a submitted CV (opens in a new tab). */
export function cvDownloadUrl(applicationId: string) {
  return `${API}/applications/${encodeURIComponent(applicationId)}/cv`;
}

export async function updateApplication(id: string, patch: { status?: string; notes?: string }) {
  const res = await fetch(`${API}/applications/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function deleteApplication(id: string) {
  const res = await fetch(`${API}/applications/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  return res.json();
}

export function getProfileId() { return currentProfileId(); }

