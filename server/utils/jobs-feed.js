/**
 * MPUZA - Live Jobs Feed Aggregator (part 1: helpers + Remotive)
 * Free, no-key sources: Remotive + Arbeitnow. Normalized to MPUZA schema.
 */
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();
let fetchImpl = null;
async function getFetch() {
  if (fetchImpl) return fetchImpl;
  if (typeof globalThis.fetch === 'function') {
    fetchImpl = globalThis.fetch.bind(globalThis);
    return fetchImpl;
  }
  const mod = await import('node-fetch');
  fetchImpl = mod.default || mod;
  return fetchImpl;
}
async function fetchWithTimeout(url, opts = {}, timeoutMs = 12000) {
  const fetchFn = await getFetch();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': 'MPUZA/1.0 (+campus-to-career)', ...(opts.headers || {}) } });
    return res;
  } finally { clearTimeout(t); }
}
function stripHtml(html = '') {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
function inferType(title = '', jobType = '') {
  const hay = `${title} ${jobType}`.toLowerCase();
  if (hay.includes('intern')) return 'internship';
  return 'fulltime';
}
function inferCategory(title = '', tags = []) {
  const hay = `${title} ${(tags || []).join(' ')}`.toLowerCase();
  if (/data|ml|ai|analyst|scientist|python|sql/.test(hay)) return 'Data';
  if (/design|ux|ui|figma/.test(hay)) return 'Design';
  if (/market|seo|social|content|brand|growth/.test(hay)) return 'Marketing';
  if (/finance|account|audit|bank/.test(hay)) return 'Finance';
  if (/product|project|program manager|scrum/.test(hay)) return 'Product';
  if (/android|ios|mobile|kotlin|swift|flutter/.test(hay)) return 'Mobile';
  if (/engineer|developer|devops|backend|frontend|full.?stack|software|cloud/.test(hay)) return 'Engineering';
  return 'Other';
}
function deadlineFromPosted(postedAt, days = 45) {
  try {
    const d = new Date(postedAt);
    if (isNaN(d.getTime())) return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
    return new Date(d.getTime() + days * 864e5).toISOString().slice(0, 10);
  } catch { return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10); }
}
async function fetchRemotive(search = '') {
  try {
    const url = `https://remotive.com/api/remote-jobs?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    const res = await fetchWithTimeout(url, {}, 12000);
    if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
    const json = await res.json();
    const jobs = json.jobs || [];
    return jobs.map((j) => {
      const requirements = Array.isArray(j.tags) ? j.tags.slice(0, 6) : [];
      if (j.job_type && !requirements.includes(j.job_type)) requirements.unshift(j.job_type);
      return {
        id: `remotive-${j.id}`, title: j.title || 'Remote Role',
        company: j.company_name || 'Remote Company',
        type: inferType(j.title, j.job_type),
        location: j.candidate_required_location || 'Remote',
        description: stripHtml(j.description || '').slice(0, 600) || `${j.title} at ${j.company_name}. Remote via Remotive.`,
        requirements: requirements.length ? requirements : ['Remote collaboration', 'Communication'],
        pay: j.salary || 'Not disclosed',
        deadline: deadlineFromPosted(j.publication_date),
        posted_at: j.publication_date || new Date().toISOString(),
        category: inferCategory(j.title, j.tags),
        tags: [...(j.tags || []).slice(0, 5), 'live', 'remote'],
        url: j.url, source: 'remotive', external: true,
      };
    });
  } catch (err) { console.warn('Remotive feed failed:', err.message); return []; }
}
async function fetchArbeitnow(search = '') {
  try {
    const res = await fetchWithTimeout('https://www.arbeitnow.com/api/job-board-api', {}, 12000);
    if (!res.ok) throw new Error(`Arbeitnow HTTP ${res.status}`);
    const json = await res.json();
    let jobs = json.data || [];
    if (search) {
      const term = search.toLowerCase();
      jobs = jobs.filter((j) => `${j.title} ${j.company_name} ${j.location} ${(j.tags || []).join(' ')}`.toLowerCase().includes(term));
    }
    return jobs.slice(0, 50).map((j) => ({
      id: `arbeitnow-${j.slug}`, title: j.title || 'Role',
      company: j.company_name || 'Company',
      type: inferType(j.title, (j.job_types || []).join(' ')),
      location: j.remote ? 'Remote' : j.location || 'Europe',
      description: stripHtml(j.description || '').slice(0, 600) || `${j.title} at ${j.company_name}.`,
      requirements: (j.tags || []).slice(0, 6).length ? j.tags.slice(0, 6) : (j.job_types || []).slice(0, 4),
      pay: 'Not disclosed',
      deadline: deadlineFromPosted(j.created_at ? new Date(j.created_at * 1000).toISOString() : null),
      posted_at: j.created_at ? new Date(j.created_at * 1000).toISOString() : new Date().toISOString(),
      category: inferCategory(j.title, j.tags),
      tags: [...(j.tags || []).slice(0, 5), 'live'],
      url: j.url, source: 'arbeitnow', external: true,
    }));
  } catch (err) { console.warn('Arbeitnow feed failed:', err.message); return []; }
}
function dedupe(jobs) {
  const seen = new Set(); const out = [];
  for (const j of jobs) {
    const key = `${(j.title || '').toLowerCase().trim()}::${(j.company || '').toLowerCase().trim()}`;
    if (seen.has(key)) continue; seen.add(key); out.push(j);
  }
  return out;
}
async function getLiveJobs({ q = '' } = {}) {
  const key = `live::${(q || '').toLowerCase().trim()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { jobs: hit.jobs, cached: true };
  const [a, b] = await Promise.all([fetchRemotive(q), fetchArbeitnow(q)]);
  const jobs = dedupe([...a, ...b]);
  jobs.sort((x, y) => new Date(y.posted_at) - new Date(x.posted_at));
  cache.set(key, { at: Date.now(), jobs });
  if (cache.size > 50) { const first = cache.keys().next().value; cache.delete(first); }
  return { jobs, cached: false };
}
function filterLiveJobs(jobs, { type, q } = {}) {
  let items = jobs || [];
  if (type && type !== 'all') items = items.filter((j) => j.type === type);
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    items = items.filter((j) => j.title?.toLowerCase().includes(term) || j.company?.toLowerCase().includes(term) || j.location?.toLowerCase().includes(term) || (j.tags || []).join(' ').toLowerCase().includes(term));
  }
  return items;
}
module.exports = { getLiveJobs, filterLiveJobs, CACHE_TTL_MS };
