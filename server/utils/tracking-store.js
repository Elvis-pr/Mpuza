/** 
 * MPUZA - Tracking store: Supabase-first, file/memory fallback.
 * Permanent on Vercel once `applications` table exists (see seed-sql.js).
 * Falls back to server/data/tracking.json locally, memory on serverless.
 * 
 * Also handles CV files: Supabase Storage bucket `application-docs` in
 * production, server/data/uploads/ locally. CVs are served only through
 * GET /api/applications/:id/cv — never directly public.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'tracking.json');
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
const CV_BUCKET = 'application-docs';
const CV_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function getSupabase() {
  try {
    const { supabase } = require('../supabase');
    return supabase || null;
  } catch { return null; }
}
function useSupabase() { return !!getSupabase(); }

/** Validate a CV upload. Returns { ok } or { ok:false, message }. */
function validateCv({ filename, mimetype, sizeBytes }) {
  const ext = String(filename || '').split('.').pop().toLowerCase();
  if (!CV_MIME[ext]) return { ok: false, message: 'CV must be a PDF, DOC, or DOCX file.' };
  if (sizeBytes > 2 * 1024 * 1024) return { ok: false, message: 'CV must be 2MB or smaller.' };
  return { ok: true, ext };
}

/**
 * Store an uploaded CV (base64) and return { path, filename }.
 * Supabase Storage in prod, local uploads dir in dev fallback.
 */
async function saveCv(profileId, applicationId, filename, base64Data) {
  const ext = String(filename).split('.').pop().toLowerCase();
  const safeName = `cv-${Date.now()}.${ext}`;
  const objectPath = `${profileId}/${applicationId}/${safeName}`;
  const buffer = Buffer.from(base64Data, 'base64');
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.storage.from(CV_BUCKET).upload(objectPath, buffer, {
      contentType: CV_MIME[ext] || 'application/octet-stream',
      upsert: false,
    });
    if (error) throw new Error(`CV upload failed: ${error.message}`);
    return { path: objectPath, filename };
  }
  // Local fallback (dev / no Supabase)
  const dir = path.join(UPLOAD_DIR, profileId, applicationId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, safeName), buffer);
  return { path: objectPath, filename };
}

/**
 * Get a CV for download: Supabase signed URL (redirect) or local file stream.
 * Returns { redirectUrl } or { streamPath } or null.
 */
async function getCv(application) {
  if (!application?.cv_path) return null;
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.storage.from(CV_BUCKET).createSignedUrl(application.cv_path, 600);
    if (error) throw new Error(`CV download failed: ${error.message}`);
    return { redirectUrl: data.signedUrl };
  }
  const localPath = path.join(UPLOAD_DIR, application.cv_path);
  if (fs.existsSync(localPath)) return { streamPath: localPath };
  return null;
}

/** Delete a CV file (best-effort) when its application is removed. */
async function deleteCv(cvPath) {
  if (!cvPath) return;
  const sb = getSupabase();
  if (sb) {
    try { await sb.storage.from(CV_BUCKET).remove([cvPath]); } catch {}
    return;
  }
  try { fs.rmSync(path.join(UPLOAD_DIR, cvPath), { recursive: true, force: true }); } catch {}
}

// ---------- local fallback (dev / no table yet) ----------
function loadLocal() {
  try {
    if (fs.existsSync(FILE)) {
      const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      return { applications: j.applications || [], interviews: j.interviews || [] };
    }
  } catch {}
  return globalThis.__mpuzaTracking || (globalThis.__mpuzaTracking = { applications: [], interviews: [] });
}
function saveLocal(db) {
  globalThis.__mpuzaTracking = db;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  } catch {}
}

// ---------- Supabase-backed ----------
async function listApplications({ profileId, status } = {}) {
  const sb = getSupabase();
  if (sb) {
    try {
      let q = sb.from('applications').select('*').order('applied_at', { ascending: false });
      if (profileId) q = q.eq('profile_id', profileId);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    } catch (e) {
      if (String(e.message || e).includes('Could not find the table')) {
        console.warn('applications table missing — using local fallback. Run seed-sql.js in Supabase.');
      } else { console.warn('Supabase listApplications failed, fallback:', e.message); }
    }
  }
  const db = loadLocal();
  let apps = db.applications;
  if (profileId) apps = apps.filter((a) => a.profile_id === profileId);
  if (status) apps = apps.filter((a) => a.status === status);
  apps.sort((a, b) => new Date(b.applied_at || 0) - new Date(a.applied_at || 0));
  return apps;
}
async function createApplication({ opportunity_id, profile_id, notes, snapshot, applicant, cover_letter }) {
  const pid = profile_id || 'local-user';
  const applicantName = (applicant?.name || '').trim();
  const applicantEmail = (applicant?.email || '').trim();
  const applicantPhone = (applicant?.phone || '').trim();
  const cover = (cover_letter || '').trim();
  const row = {
    profile_id: pid, opportunity_id, status: 'applied',
    notes: notes || '', snapshot: snapshot || null,
    applicant_name: applicantName,
    applicant_email: applicantEmail,
    applicant_phone: applicantPhone,
    cover_letter: cover,
  };
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: existing } = await sb.from('applications').select('*')
        .eq('profile_id', pid).eq('opportunity_id', opportunity_id).maybeSingle();
      if (existing) return { application: existing, deduped: true };
      const { data, error } = await sb.from('applications').insert(row).select().single();
      if (error) throw error;
      return { application: data, deduped: false };
    } catch (e) {
      console.warn('Supabase createApplication failed, fallback:', e.message);
    }
  }
  const db = loadLocal();
  const dup = db.applications.find((a) => a.profile_id === pid && a.opportunity_id === opportunity_id);
  if (dup) return { application: dup, deduped: true };
  const app = {
    id: 'app-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
    ...row,
    applied_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  db.applications.unshift(app); saveLocal(db);
  return { application: app, deduped: false };
}
async function getApplication(id) {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from('applications').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (data) return data;
    } catch (e) { console.warn('Supabase getApplication failed, fallback:', e.message); }
  }
  return loadLocal().applications.find((a) => a.id === id) || null;
}
async function updateApplication(id, { status, notes, cv_path, cv_filename }) {
  const sb = getSupabase();
  if (sb) {
    try {
      const patch = {};
      if (status) patch.status = status;
      if (notes !== undefined) patch.notes = notes;
      if (cv_path !== undefined) patch.cv_path = cv_path;
      if (cv_filename !== undefined) patch.cv_filename = cv_filename;
      const { data, error } = await sb.from('applications').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } catch (e) { console.warn('Supabase updateApplication failed, fallback:', e.message); }
  }
  const db = loadLocal();
  const app = db.applications.find((a) => a.id === id);
  if (!app) return null;
  if (status) app.status = status;
  if (notes !== undefined) app.notes = notes;
  if (cv_path !== undefined) app.cv_path = cv_path;
  if (cv_filename !== undefined) app.cv_filename = cv_filename;
  app.updated_at = new Date().toISOString();
  saveLocal(db); return app;
}
async function deleteApplication(id) {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: app } = await sb.from('applications').select('cv_path').eq('id', id).maybeSingle();
      const { error } = await sb.from('applications').delete().eq('id', id);
      if (error) throw error;
      if (app?.cv_path) await deleteCv(app.cv_path);
      return true;
    } catch (e) { console.warn('Supabase deleteApplication failed, fallback:', e.message); }
  }
  const db = loadLocal();
  const idx = db.applications.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  if (db.applications[idx].cv_path) await deleteCv(db.applications[idx].cv_path);
  db.applications.splice(idx, 1);
  saveLocal(db); return true;
}
module.exports = {
  listApplications, createApplication, getApplication, updateApplication, deleteApplication,
  validateCv, saveCv, getCv, useSupabase,
};
