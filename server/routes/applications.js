/**
 * MPUZA - Applications API Routes
 *
 * Endpoints:
 *   GET  /api/applications          - list user's applications
 *   POST /api/applications          - submit a real application (details + CV)
 *   GET  /api/applications/:id      - get application detail
 *   GET  /api/applications/:id/cv   - download the submitted CV
 *   PUT  /api/applications/:id      - update application status
 *   DELETE /api/applications/:id    - withdraw / remove
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

// POST /api/applications
// Submits a real application: applicant details, cover letter, and optional CV.
// Body: { opportunity_id, snapshot?, notes?, applicant: {name, email, phone?}, cover_letter?, cv?: { filename, data_base64 } }
router.post('/', async (req, res) => {
  try {
    const { opportunity_id, notes, snapshot, applicant, cover_letter, cv } = req.body || {};
    if (!opportunity_id) return res.status(400).json({ success: false, message: 'opportunity_id required' });
    const name = String(applicant?.name || '').trim();
    const email = String(applicant?.email || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Applicant name is required.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid applicant email is required.' });
    }
    const phone = String(applicant?.phone || '').trim();
    const cover = String(cover_letter || '').trim();
    if (cover.length > 5000) return res.status(400).json({ success: false, message: 'Cover letter must be 5000 characters or fewer.' });

    const profileId = await resolveProfileId(req);
    const { application, deduped } = await store.createApplication({
      opportunity_id, profile_id: profileId, notes, snapshot,
      applicant: { name, email, phone }, cover_letter: cover,
    });

    // Attach CV (validated + stored) after the row exists so we have an id
    let cvInfo = null;
    if (cv?.data_base64 && cv?.filename) {
      const check = store.validateCv({ filename: cv.filename, sizeBytes: Math.floor(cv.data_base64.length * 0.75) });
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
      try {
        const saved = await store.saveCv(profileId, application.id, cv.filename, cv.data_base64);
        cvInfo = saved;
        // Persist the CV location on the row (Supabase or local fallback)
        const updated = await store.updateApplication(application.id, { cv_path: saved.path, cv_filename: saved.filename });
        if (updated) Object.assign(application, updated);
        else { application.cv_path = saved.path; application.cv_filename = saved.filename; }
      } catch (e) {
        console.warn('CV upload failed (application still recorded):', e.message);
        return res.status(500).json({
          success: false,
          message: `Application recorded, but CV upload failed: ${e.message}. Re-upload from My Applications.`,
          application,
        });
      }
    }

    res.status(deduped ? 200 : 201).json({
      success: true, application, deduped,
      cv: cvInfo, persistent: store.useSupabase(),
    });
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

// GET /api/applications/:id/cv — download the submitted CV
// Supabase: redirects to a 10-min signed URL. Local dev: streams the file.
router.get('/:id/cv', async (req, res) => {
  try {
    const app = await store.getApplication(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (!app.cv_path) return res.status(404).json({ success: false, message: 'No CV attached to this application' });
    const cv = await store.getCv(app);
    if (!cv) return res.status(404).json({ success: false, message: 'CV file no longer available' });
    if (cv.redirectUrl) return res.redirect(302, cv.redirectUrl);
    const ext = (app.cv_filename || app.cv_path || '').split('.').pop().toLowerCase();
    const mime = ext === 'pdf' ? 'application/pdf'
      : ext === 'doc' ? 'application/msword'
      : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${(app.cv_filename || 'cv.' + ext).replace(/"/g, '')}"`);
    res.sendFile(cv.streamPath);
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
