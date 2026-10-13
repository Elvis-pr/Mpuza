/**
 * MPUZA - Tracking store: Supabase-first, file/memory fallback.
 * Permanent on Vercel once `applications` table exists (see seed-sql.js).
 * Falls back to server/data/tracking.json locally, memory on serverless.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'tracking.json');

function getSupabase() {
  try {
    const { supabase } = require('../supabase');
    return supabase || null;
  } catch { return null; }
}
function useSupabase() { return !!getSupabase(); }

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
async function createApplication({ opportunity_id, profile_id, notes, snapshot }) {
  const pid = profile_id || 'local-user';
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: existing } = await sb.from('applications').select('*')
        .eq('profile_id', pid).eq('opportunity_id', opportunity_id).maybeSingle();
      if (existing) return { application: existing, deduped: true };
      const { data, error } = await sb.from('applications').insert({
        profile_id: pid, opportunity_id, status: 'applied',
        notes: notes || '', snapshot: snapshot || null,
      }).select().single();
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
    profile_id: pid, opportunity_id, status: 'applied',
    applied_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    notes: notes || '', snapshot: snapshot || null,
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
async function updateApplication(id, { status, notes }) {
  const sb = getSupabase();
  if (sb) {
    try {
      const patch = {};
      if (status) patch.status = status;
      if (notes !== undefined) patch.notes = notes;
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
  app.updated_at = new Date().toISOString();
  saveLocal(db); return app;
}
module.exports = { listApplications, createApplication, getApplication, updateApplication, useSupabase };
