/**
 * MPUZA - Profiles API Routes
 *
 * Endpoints:
 *   GET  /api/profiles           - list public profiles (with filters)
 *   GET  /api/profiles/:id       - single public profile
 *   GET  /api/profiles/:id/company - company of a profile
 *   GET  /api/profiles/:id/opportunities - opportunities posted by a profile
 *   GET  /api/profiles/:id/contacts - contact info of a profile (expandable)
 *   PATCH /api/profiles/:id      - update own profile (auth required)
 *   PATCH /api/profiles/:id/company - update company/hireable (auth required)
 *   PATCH /api/profiles/:id/contacts - update contacts (auth required)
 */

const express = require('express');
const router = express.Router();
const { getSupabase } = require('../db');
const { publicUser } = require('../utils/auth-store');

// GET /api/profiles - paginated list of public profiles
router.get('/', async (req, res) => {
  try {
    const { q, company, limit = 50, offset = 0 } = req.query;
    const sb = getSupabase();
    if (!sb) return res.json({ success: true, profiles: [] });

    let query = sb.from('profiles').select('*');
    if (q) {
      const like = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\-')}%`;
      query = query.or(`name.ilike.*${like}*,title.ilike.*${like}*,company_name.ilike.*${like}*`);
    }
    if (company) {
      query = query.eq('company_id', String(company));
    }
    query = query.order('created_at', { ascending: false }).limit(Number(limit)).offset(Number(offset));

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, profiles: data || [] });
  } catch (err) {
    console.error('❌ Profiles list error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/profiles/:id - single public profile (hidden fields toggle)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { showHidden = 'false' } = req.query;
    const sb = getSupabase();
    if (!sb) return res.json({ success: true, profile: null });

    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code === 'PGRST116') return res.json({ success: true, profile: null });
    if (error) throw error;
    if (!data) return res.json({ success: true, profile: null });

    // Only show hidden fields if authorized or explicitly requested
    const profile = showHidden === 'true' ? data : {
      id: data.id,
      name: data.name,
      avatar_url: data.avatar_url,
      title: data.title,
      company_name: data.company_name,
      hireable: data.hireable,
      created_at: data.created_at,
      profile_url: `/profiles/${data.id}`,
    };
    res.json({ success: true, profile });
  } catch (err) {
    console.error('❌ Profile get error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/profiles/:id/company - detailed company info
router.get('/:id/company', async (req, res) => {
  try {
    const { id } = req.params;
    const sb = getSupabase();
    if (!sb) return res.json({ success: true, company: null });

    const { data, error } = await sb
      .from('profiles')
      .select('company_id, company_name, hireable, contacts, avatar_url, title')
      .eq('id', id)
      .single();
    if (error && error.code === 'PGRST116') return res.json({ success: true, company: null });
    if (error) throw error;
    if (!data) return res.json({ success: true, company: null });

    res.json({ success: true, company: {
      id: data.company_id,
      name: data.company_name,
      hireable: data.hireable,
      contacts: data.contacts,
      avatar_url: data.avatar_url,
      title: data.title,
    } });
  } catch (err) {
    console.error('❌ Company get error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/profiles/:id/opportunities - opportunities posted by a profile
router.get('/:id/opportunities', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const sb = getSupabase();
    if (!sb) return res.json({ success: true, opportunities: [] });

    const { data, error } = await sb
      .from('opportunities')
      .select('*')
      .eq('owner_id', id)
      .order('posted_at', { ascending: false })
      .limit(Number(limit))
      .offset(Number(offset));
    if (error && error.code === 'PGRST116') return res.json({ success: true, opportunities: [] });
    if (error) throw error;

    res.json({ success: true, opportunities: data || [] });
  } catch (err) {
    console.error('❌ Opportunities get error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/profiles/:id/contacts - contact info (expandable - toggle)
router.get('/:id/contacts', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeHidden = 'false' } = req.query;
    const sb = getSupabase();
    if (!sb) return res.json({ success: true, contacts: {} });

    const { data, error } = await sb
      .from('profiles')
      .select('contacts, email, phone, linkedin, twitter, github, website')
      .eq('id', id)
      .single();
    if (error && error.code === 'PGRST116') return res.json({ success: true, contacts: {} });
    if (error) throw error;
    if (!data) return res.json({ success: true, contacts: {} });

    // Hide private contact fields unless authorized
    const contacts = includeHidden === 'true' ? data.contacts : {};
    res.json({ success: true, contacts });
  } catch (err) {
    console.error('❌ Contacts get error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/profiles/:id - update own profile
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const sb = getSupabase();
    if (!sb) return res.status(400).json({ success: false, message: 'Supabase not configured' });

    // Check ownership (simplified - in production use JWT)
    const { data: existing, error: checkError } = await sb.from('profiles').select('owner_id, user_id').eq('id', id).single();
    if (checkError && checkError.code !== 'PGRST116') throw checkError;
    if (!existing) return res.status(404).json({ success: false, message: 'Profile not found' });

    // TODO: Add auth middleware to verify owner
    const { data, error } = await sb
      .from('profiles')
      .update({
        name: updates.name ?? existing.name,
        avatar_url: updates.avatar_url ?? existing.avatar_url,
        title: updates.title ?? existing.title,
        company_id: updates.company_id ?? existing.company_id,
        company_name: updates.company_name ?? existing.company_name,
        hireable: updates.hireable ?? existing.hireable,
        contacts: updates.contacts ?? existing.contacts,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    res.json({ success: true, profile: data });
  } catch (err) {
    console.error('❌ Profile update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/profiles/:id/company - update company/hireable
router.patch('/:id/company', async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, hireable } = req.body || {};
    const sb = getSupabase();
    if (!sb) return res.status(400).json({ success: false, message: 'Supabase not configured' });

    const { data, error } = await sb
      .from('profiles')
      .update({
        company_name: company_name ?? data.company_name,
        hireable: hireable ?? data.hireable,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    res.json({ success: true, company: data });
  } catch (err) {
    console.error('❌ Company update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/profiles/:id/contacts - update contact info
router.patch('/:id/contacts', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, phone, linkedin, twitter, github, website } = req.body || {};
    const sb = getSupabase();
    if (!sb) return res.status(400).json({ success: false, message: 'Supabase not configured' });

    const current = await sb.from('profiles').select('contacts').eq('id', id).single();
    if (current.error && current.error.code !== 'PGRST116') throw current.error;
    if (current.error) return res.json({ success: true, contacts: {} });

    const contacts = {
      ...current.data.contacts,
      email: email ?? current.data.contacts.email,
      phone: phone ?? current.data.contacts.phone,
      linkedin: linkedin ?? current.data.contacts.linkedin,
      twitter: twitter ?? current.data.contacts.twitter,
      github: github ?? current.data.contacts.github,
      website: website ?? current.data.contacts.website,
    };

    const { data, error } = await sb
      .from('profiles')
      .update({ contacts })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    res.json({ success: true, contacts: data.contacts });
  } catch (err) {
    console.error('❌ Contacts update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
