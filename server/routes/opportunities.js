/**
 * MPUZA - Opportunities API Routes
 *
 * Endpoints:
 *   GET  /api/opportunities           - list all opportunities
 *   GET  /api/opportunities/match     - AI-matched opportunities for a student profile
 *   GET  /api/opportunities/:id       - get one opportunity
 *   POST /api/opportunities           - create (admin)
 *   PUT  /api/opportunities/:id       - update (admin)
 *   DELETE /api/opportunities/:id      - delete (admin)
 *
 * All routes use Supabase (via server/supabase.js)
 */

const express = require('express');
const router = express.Router();
const {
  listOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  listResources,
} = require('../db');
const { matchOpportunities, getMatchStats } = require('../utils/matcher');

// GET /api/opportunities
// Merges curated jobs (Supabase/local) + LIVE jobs (Remotive/Arbeitnow).
// Query: ?type=all|internship|fulltime&q=...&category=...&source=curated|live|all (default all)
router.get('/', async (req, res) => {
  try {
    const { type, q, category, source } = req.query;
    const src = (source || 'all').toLowerCase();
    let curated = { success: true, total: 0, grouped: { internship: [], fulltime: [] }, resources: [] };
    if (src !== 'live') {
      try {
        curated = await listOpportunities({ type, q, category });
      } catch (e) {
        console.warn('Curated list failed:', e.message);
      }
    }
    let curatedItems = [
      ...(curated.grouped?.internship || []),
      ...(curated.grouped?.fulltime || []),
    ].map((o) => ({ ...o, source: o.source || 'curated', external: false }));
    let resources = curated.resources || [];
    try {
      if (!resources.length) resources = await listResources();
    } catch (e) { resources = []; }

    let liveItems = [];
    let liveMeta = { enabled: src !== 'curated', count: 0, cached: false, error: null };
    if (src !== 'curated') {
      try {
        const { getLiveJobs, filterLiveJobs } = require('../utils/jobs-feed');
        const { jobs, cached } = await getLiveJobs({ q: q || '' });
        liveItems = filterLiveJobs(jobs, { type, q });
        if (category) liveItems = liveItems.filter((j) => (j.category || '').toLowerCase() === String(category).toLowerCase());
        liveMeta = { enabled: true, count: liveItems.length, cached, error: null };
      } catch (e) {
        liveMeta = { enabled: true, count: 0, cached: false, error: e.message };
      }
    }

    const seen = new Set(curatedItems.map((o) => `${(o.title || '').toLowerCase()}::${(o.company || '').toLowerCase()}`));
    for (const j of liveItems) {
      const k = `${(j.title || '').toLowerCase()}::${(j.company || '').toLowerCase()}`;
      if (!seen.has(k)) { seen.add(k); curatedItems.push(j); }
    }
    curatedItems.sort((a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0));
    const grouped = {
      internship: curatedItems.filter((o) => o.type === 'internship'),
      fulltime: curatedItems.filter((o) => o.type !== 'internship'),
    };
    res.json({ success: true, total: curatedItems.length, grouped, resources, live: liveMeta });
  } catch (err) {
    console.error('Opportunities list error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/opportunities/match
// Matches opportunities to a student profile based on skills.
// Works across curated + live jobs so Match Me ranks REAL jobs.
router.get('/match', async (req, res) => {
  try {
    const { studentProfile, q, type, category } = req.query;

    // Parse student profile from query string (in production, use JWT auth)
    let profile = null;
    if (studentProfile) {
      try {
        profile = JSON.parse(decodeURIComponent(studentProfile));
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid student profile JSON' });
      }
    }

    // Get opportunities (filtered) from curated store + live feed
    let opportunities = [];
    try {
      const result = await listOpportunities({ type, q });
      if (result.success && result.grouped) {
        opportunities = [...(result.grouped.internship || []), ...(result.grouped.fulltime || [])];
      }
    } catch (e) { console.warn('Match curated fetch failed:', e.message); }
    try {
      const { getLiveJobs, filterLiveJobs } = require('../utils/jobs-feed');
      const { jobs } = await getLiveJobs({ q: q || '' });
      opportunities = [...opportunities, ...filterLiveJobs(jobs, { type, q })];
    } catch (e) { console.warn('Match live fetch failed:', e.message); }

    if (category) {
      opportunities = opportunities.filter(opp => (opp.category || '').toLowerCase() === String(category).toLowerCase());
    }

    // Run matching — pass opportunities explicitly (matcher falls back to
    // local file otherwise, which would hide live jobs)
    const matched = matchOpportunities(profile, opportunities, { opportunities });
    const stats = getMatchStats(profile, opportunities);

    res.json({
      success: true,
      matched,
      stats,
      profile: profile ? { id: profile.id, skillsCount: profile.skills?.length || 0, year: profile.year } : null,
    });
  } catch (err) {
    console.error('❌ Match error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/opportunities/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getOpportunityById(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/opportunities (create)
router.post('/', async (req, res) => {
  try {
    const newOpp = req.body;
    const result = await createOpportunity(newOpp);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/opportunities/:id (update)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const result = await updateOpportunity(id, updates);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/opportunities/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteOpportunity(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
