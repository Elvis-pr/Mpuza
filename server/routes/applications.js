/**
 * MPUZA - Applications API Routes
 *
 * Endpoints:
 *   GET  /api/applications          - list user's applications
 *   POST /api/applications          - apply to an opportunity
 *   GET  /api/applications/:id      - get application detail
 *   PUT  /api/applications/:id      - update application status
 *
 * All routes use Supabase (via server/supabase.js)
 */

const express = require('express');
const router = express.Router();
const store = require('../utils/tracking-store');
const { resolveProfileId } = require('../utils/auth-middleware');

// GET /api/applications?profileId=...&status=...
// Permanent on Vercel once Supabase `applications` table exists;
// otherwise local fallback (dev) so deploy is never blocked.
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const profileId = await resolveProfileId(req);
    const applications = await store.listApplications({ profileId, status });
    res.json({ success: true, applications, persistent: store.useSupabase() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/applications { opportunity_id, profileId?, notes?, snapshot? }
// snapshot = { title, company, location, url, source } so external jobs still render.
router.post('/', async (req, res) => {
  try {
    const { opportunity_id, notes, snapshot } = req.body;
    if (!opportunity_id) return res.status(400).json({ success: false, message: 'opportunity_id required' });
    const profileId = await resolveProfileId(req);
    const { application, deduped } = await store.createApplication({
      opportunity_id, profile_id: profileId, notes, snapshot,
    });
    res.status(deduped ? 200 : 201).json({ success: true, application, deduped, persistent: store.useSupabase() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/applications/:id
router.get('/:id', async (req, res) => {
  try {
    const app = await store.getApplication(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, application: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/applications/:id { status, notes }
router.put('/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const valid = ['saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'];
    if (status && !valid.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${valid.join(', ')}` });
    }
    const app = await store.updateApplication(req.params.id, { status, notes });
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, application: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/applications/:id — withdraw / remove tracking
router.delete('/:id', async (req, res) => {
  try {
    const ok = await store.deleteApplication(req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
